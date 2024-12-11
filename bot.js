const token = process.env.TOKEN;

const Bot = require('node-telegram-bot-api')
const rp = require('request-promise')
const cheerio = require('cheerio')
const fs = require('fs')
const mongoose = require('mongoose')
const Subscriber = require('./model/Subscriber')
const TelegramError = require('./Handlers/TelegramError')
const TelegramResolve = require('./Handlers/TelegramResolve')

// Todo remove it
const json = 'responses.json'
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

const db = mongoose.connection;
const minutes = (minutes) => ((1000 * 60) * minutes)
const bot = new Bot(token, { polling: true });
let chatid;

db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', function () {
    // Connected

})

/**
 * 
 * Riceve come valore l'istanza TelegramResolve. 
 * Al momento handleError fa la stessa cosa però ho preferito dividerle per un futuro handler migliore.
 * @param new TelegramResolve()
 */
const handleSuccesses = (success) => {
    if (success.type === 'telegram-success-handler') {
        console.log(success);
        bot.sendMessage(chatid, success.message);
    }
}

/**
 *
 * Riceve come valore l'istanza TelegramResolve.
 * Al momento handleSuccess fa la stessa cosa però ho preferito dividerle per un futuro handler migliore.
 * @param new TelegramError()
 */
const handleError = (error) => {
    if (error.type === 'telegram-error-handler') {
        console.log(error);
        bot.sendMessage(chatid, error.message);
    }
}

const checkForUpdates = async () => {
    let currentSubscriberIndex = 0;
    const subscribers = await Subscriber.find({}, (err, result) => {
        return result;
    });
    /**
     * 
     * Funzione per gestire gli abbonati al bot. 
     * 
     * 1. Esegue un loop di tutti gli abbonati. Salva subito l'id e inizia a fetchare ogni risorsa.
     * 2. Prende tutte le risorse e controlla quali sono nuove. 
     * 3. Se ne esiste almeno una nuova invia il messaggio all'utente.
     * 
     * @TODO rimuovere il messaggi di avviso quando non c'è nessuna nuova news.
     * @param object subscriber 
     */
    const handleSubscriber = async (subscriber, currentSubIndex) => {

        /**
         * Costante che definisce l'index del subscriber corrente.
         */
        const currentSubscriberIndex = currentSubIndex;

        /**
         * Costante che definisce l'id della chat del subscriber.
         */
        const chatid = subscriber.telegramID;

        /**
         * Variabile che segnala l'array del topic corrente.
         */
        let currentTopicIndex = -1;

        /**
         * Variabile che contiene tutto l'html della pagina di Subito.it
         */
        let html = '';

        /**
         * 
         * Funzione per effettuare lo scraping degli elementi di subito.it
         * 
         * Banale, non c'è bisogno di spiegarla.
         * @param document html 
         * @param int limit 
         * 
         * @return array of objects
         */
        const fetchFromSubito = (html, limit = 5) => {
            const $ = cheerio.load(html)
            const itemsResponse = $('.items__item.item-card');
            const items = [];
            let count = 0;
            $(itemsResponse).each((i, elem) => {
                if ($(elem).find('.index-module_sbt-text-atom__ifYVU').length) {
                    if (count < limit) {
                        const url = $(elem).find('.SmallCard-module_link__hOkzY').attr('href');
                        const id = url.substring(url.lastIndexOf('-') + 1, url.indexOf('.htm'));
                        const item = {
                            id: id,
                            url: url,
                            title: $(elem).find('h2.index-module_sbt-text-atom__ifYVU').text(),
                            image: $(elem).find('.CardImage-module_photo__WMsiO').attr('src'),
                            location: $(elem).find('.PostingTimeAndPlace-module_date-location__1Owcv').text(),
                            price: $(elem).find('.index-module_price__N7M2x').text() || false
                        }
                        items.push(item);
                        count++;
                    }
                }
            })
            return items;
        }

        /**
         * 
         * Funzione che definisce quali sono i nuovi item nella ricerca di Subito.it
         * 
         * 1. Prende l'array contenente tutti gli item già visionati prima. 
         * 2. Controlla che quelli appena presi dall'HTML di Subito non siano 
         *    già stati salvati prima d'ora.
         * 3. Ritorna la parte dell'array che ancora non è stato segnalato. Se l'array torna vuoto 
         *    vuol dire che gli elementi non sono ancora stati aggiornati.
         * 
         * @param array items 
         *
         * @return array newestItems
         */
        const grabNewestArticles = (items) => {
            const savedIds = subscriber.topic[currentTopicIndex].items;
            let indexOfLastNewest = -1;

            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                for (let i = 0; i < savedIds.length; i++) {
                    const { id } = savedIds[i];
                    if (item.id === id) {
                        indexOfLastNewest = j;
                        break;
                    }
                }

                if (indexOfLastNewest !== -1) {
                    break;
                }
            }
            if (indexOfLastNewest !== -1) {
                return items.splice(0, indexOfLastNewest);
            } else {
                return items;
            }
        }


        /**
         * 
         * Funzione finale. Salva l'array di items.
         * 
         * @param array newestItems 
         */

        const saveSentItems = (newestItems) => {
            subscriber.topic[currentTopicIndex].items = newestItems;
            subscriber.save();
        }

        /**
         * 
         * Invia per messaggio i nuovi items. 
         * 
         * Non ritorna niente ma al termine fa partire una seconda funzione 
         * che salva gli items appena inviati.
         * 
         * @param array newestItems 
         */
        const sendMessages = (newestItems) => {
            for (item of newestItems) {
                var options = {
                    caption: `${item.title}\n\n${item.location.replace(' - ', '\n')}\n\n${item.price}`,
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: "Vedi l'articolo", url: item.url }]
                        ]
                    })
                };
                bot.sendPhoto(chatid, item.image, options)
                    .catch(err => {
                        console.error('NEW ERROR:', err);
                    })
            }
            saveSentItems(newestItems);
        }

        for (topic of subscriber.topic) {
            const { url } = topic;
            html = await rp(url);
            currentTopicIndex = currentTopicIndex + 1;
            const items = fetchFromSubito(html);
            if (!items.length)
                return;

            const newestItems = grabNewestArticles(items);
            if (newestItems.length > 0) {
                sendMessages(newestItems);
            } else {
                //bot.sendMessage(chatid, `Nessun nuovo articolo per il topic: ${topic.url}`);
            }
        }
    }

    for (subscriber of subscribers) {
        handleSubscriber(subscriber, currentSubscriberIndex);
        currentSubscriberIndex++;
    }
}

/**
 * Controlla se l'utente è un nuovo utente. 
 * In caso non lo sia prova ad aggiungere all'utente corrente il topic scelto.
 */
const subscribeToBot = (subito_url) => {
    const subscribeNewUser = new Promise((resolve, reject) => {
        Subscriber.findOne({ telegramID: chatid }, (error, result) => {
            if (!result) {
                // Nessun utente trovato. Aggiungerlo.
                const subscriber = new Subscriber({ telegramID: chatid });
                subscriber.topic.push({ url: subito_url, item: [] });
                subscriber.save();
                resolve(new TelegramResolve(0));
            } else {
                // Utente trovato. Aggiungere il topic.
                const succesfull = addNewTopicToUser(result, subito_url);
                if (succesfull) {
                    resolve(new TelegramResolve(1))
                } else {
                    reject(new TelegramError(1))
                }
            }
        })
    })
    subscribeNewUser
        .then(response => {
            handleSuccesses(response);
        })
        .catch(error => {
            handleError(error);
        })
}

/**
 * 
 * L'utente esiste già nel database, quindi aggiungo il topic alla sua lista di interessi.
 * In caso il topic sia già presente ritorno false per gestire l'errore.
 */
const addNewTopicToUser = (user, subito_url) => {
    const equalTopic = user.topic.filter(t => t.url === subito_url);
    if (equalTopic.length > 0) {
        return false;
    } else {
        user.topic.push({ url: subito_url, item: [] });
        user.save();
        return true;
    }
}

/**
 * 
 * Se l'utente esiste faccio una lista di tutti i suoi topic.
 */
const listSubscriptions = () => {
    const response = new Promise((resolve, reject) => {
        Subscriber.findOne({ telegramID: chatid }, (error, result) => {
            if (result) {
                let message = '';
                let index = 1;
                if (result.topic.length > 0) {
                    for (topic of result.topic) {
                        message += `${index}. ${topic.url} \n\n`
                        index++;
                    }
                }
                resolve(new TelegramResolve(2, message));
            } else {
                reject(new TelegramError(0));
            }
        })
    })
    response
        .then(message => handleSuccesses(message))
        .catch(error => handleError(error))
}

/**
 * 
 * L'utente ha richiesto di rimuovere un topic
 */
const unsubscribeFromBot = (subito_url) => {
    const response = new Promise((resolve, reject) => {
        Subscriber.findOne({ telegramID: chatid }, (error, result) => {
            if (result) {
                const oldLength = result.topic.length;
                result.topic = result.topic.filter(t => t.url !== subito_url);

                console.log(oldLength + '!=' + result.topic.length);

                if (result.topic.length != oldLength) {
                    // Topic rimosso correttamente
                    result.save();
                    resolve(new TelegramResolve(1))
                } else {
                    reject(new TelegramError(2))
                }
            } else {
                reject(new TelegramError(0))
            }
        })
    })
    response
        .then(success => handleSuccesses(success))
        .catch(error => handleError(error))
}

bot.on("polling_error", (err) => console.log(err));

const commands = {
    help: () => {
        const helpMessage = `
        <b>Lista comandi disponibili</b>
        /start subito.it/url - Traccia i nuovi annunci.

        /list - Lista di tutte le sottoscrizioni.
        `;
        bot.sendMessage(dedent(helpMessage), {
            parse_mode: "HTML"
        });
    },
    start: (msg) => {
        const url = msg.text.toLowerCase().replace('/start ', '');
        if (validURL(url) && url.indexOf('subito.it') !== -1) {
            subscribeToBot(url);
        } else {
            // TODO: aggiungi un valido messaggio di risposta. Spiegazione di come compilare correttamente il messaggio di start
            bot.sendMessage(chatid, 'Comando start errato');
        }
    },
    list: () => {
        listSubscriptions();
    },
    cancel: (msg) => {
        const url = msg.text.toLowerCase().replace('/cancel ', '');
        if (validURL(url) && url.indexOf('subito.it') !== -1) {
            unsubscribeFromBot(url)
        } else {
            // TODO: aggiungi un valido messaggio di risposta. Spiegazione di come compilare correttamente il messaggio di rimuovi
            bot.sendMessage(chatid, 'Comando rimuovi errato')
        }
    }
}

bot.on('message', (msg) => {
    /**
     * 
     * start - Iscriviti a un topic
     * list - Lista di tutti i topic a cui sei iscritto
     * cancel - Disiscriviti da un topic
     * 
     */
    chatid = msg.chat.id

    /**
     * HELP COMMAND
     * 
     * Return every other commands available
     */

    if (isValidCommand(msg, '/help')) {
        commands.help(chatid);
        return true;
    }

    /**
     * START COMMAND
     * 
     * Iscrive un utente
     */
    if (isValidCommand(msg, '/start')) {
        commands.start(msg);
        return true;
    }

    if (isValidCommand(msg, '/list')) {
        commands.list();
        return true;
    }

    /**
     * CANCEL COMMAND
     * 
     * Disiscrive un utente dalla lista.
     */

    if (isValidCommand(msg, '/cancel')) {
        commands.cancel(msg)
        return true;
    }

    /**
     * DEFAULT COMMAND
     * 
     * Dato il return messo in ogni listener del comando. Se arrivo fino a qui vuol dire che nessun comando dato era valido. Invio il comando HELP.
     */

    commands.help();
    return true;
});

const isValidCommand = (msg, command) => {
    if (msg.text.toLowerCase().indexOf(command) === 0) {
        return true;
    } else {
        return false;
    }
}

setInterval(checkForUpdates, minutes(5));

const validURL = (str) => {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

function dedent(callSite, ...args) {

    function format(str) {

        let size = -1;

        return str.replace(/\n(\s+)/g, (m, m1) => {

            if (size < 0)
                size = m1.replace(/\t/g, "    ").length;

            return "\n" + m1.slice(Math.min(m1.length, size));
        });
    }

    if (typeof callSite === "string")
        return format(callSite);

    if (typeof callSite === "function")
        return (...args) => format(callSite(...args));

    let output = callSite
        .slice(0, args.length + 1)
        .map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
        .join("");

    return format(output);
}

module.exports = bot;