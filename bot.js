const token = process.env.TOKEN;

const Bot = require('node-telegram-bot-api')
const rp = require('request-promise')
const $ = require('cheerio')
const fs = require('fs')
const json = 'responses.json'
const minutes = (minutes) => ((1000 * 60) * minutes)
const bot = new Bot(token, { polling: true });

const checkForUpdates = () => {
    let currentSubscriberIndex = 0;
    const subscribers = JSON.parse(fs.readFileSync(json));
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
    const handleSubscriber = async (subscriber, currentSubscriber) => {

        /**
         * Costante che definisce l'index del subscriber corrente.
         */
        const currentSubscriberIndex = currentSubscriber;

        /**
         * Costante che definisce l'id della chat del subscriber.
         */
        const chatid = subscriber.id;

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
        const fetchFromSubito = (html, limit = 3) => {
            const itemsResponse = $('.items .items__item', html);
            const items = [];
            let count = 0;
            $(itemsResponse).each((i, elem) => {
                if ($(elem).find('.item-title').length) {
                    if (count < limit) {
                        const url = $(elem).find('.link').attr('href');
                        const id = url.substring(url.lastIndexOf('-') + 1, url.indexOf('.htm'));
                        const item = {
                            id: id,
                            url: url,
                            title: $(elem).find('.item-title').text(),
                            image: $(elem).find('.item-picture img').attr('src')
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
            const savedIds = subscriber.subscribed[currentTopicIndex].items;
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
            try {
                subscribers[currentSubscriberIndex].subscribed[currentTopicIndex].items = newestItems;
                fs.writeFileSync(json, JSON.stringify(subscribers));
            } catch (error) {
                console.log("Si è verificato un errore", error);
            }
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
                    caption: item.title,
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

        for (topic of subscriber.subscribed) {
            const { url } = topic;
            html = await rp(url);
            currentTopicIndex = currentTopicIndex + 1;
            const items = fetchFromSubito(html);
            const newestItems = grabNewestArticles(items);
            if (newestItems.length > 0) {
                console.log('new items!');
                sendMessages(newestItems);
            } else {
                console.log('no new items');
                //bot.sendMessage(chatid, `Nessun nuovo articolo per il topic: ${topic.url}`);
            }
        }
    }

    for (subscriber of subscribers) {
        handleSubscriber(subscriber, currentSubscriberIndex);
        currentSubscriberIndex++;
    }
}

const subscribeToBot = (chatid, subito_url) => {
    try {
        const response = JSON.parse(fs.readFileSync(json));
        let subscriberIndex = 15;
        const subscriber = response.filter((item, key) => {
            if (item.id === chatid) {
                subscriberIndex = key;
            }
            return item.id === chatid;
        });
        // Check if user is already subscribed
        if (subscriber.length) {
            // Already subscribed!
            response[subscriberIndex].subscribed.push({
                url: subito_url,
                items: []
            })
        } else {
            // New user!
            response.push({
                id: chatid,
                subscribed: [
                    {
                        url: subito_url,
                        items: []
                    }
                ]
            });
        }
        fs.writeFileSync(json, JSON.stringify(response));
        bot.sendMessage(chatid, 'Iscritto con successo!')
    } catch (error) {
        console.log('polling error???', error);
        bot.sendMessage(chatid, 'Si è verificato un errore')
    }
}

const listSubscriptions = (chatid) => {
    try {
        const response = JSON.parse(fs.readFileSync(json));
        const subscriptions = response.filter(i => i.id === chatid)[0].subscribed;
        let message = '';
        let index = 1;
        for (sub of subscriptions) {
            message += `${index}. ${sub.url} \n\n`
            index++;
        }
        return message;
    } catch (error) {
        bot.sendMessage(chatid, 'Si è verificato un errore');
    }
}

const unsubscribeFromBot = (chatid) => {
    try {
        const response = JSON.parse(fs.readFileSync(json));
        const newResponse = response.filter(i => i.id !== chatid);
        fs.writeFileSync(json, JSON.stringify(newResponse));
        bot.sendMessage(chatid, 'Disiscritto con successo.')
    } catch (err) {
        bot.sendMessage(chatid, 'Si è verificato un errore')
    }
}

bot.on("polling_error", (err) => console.log(err));

const commands = {
    help: (id) => {
        const helpMessage = `
        <b>Lista comandi disponibili</b>
        /start subito.it/url - Traccia i nuovi annunci.

        /list - Lista di tutte le sottoscrizioni.
        `;
        bot.sendMessage(id, dedent(helpMessage), {
            parse_mode: "HTML"
        });
    },
    start: (id, msg) => {
        const url = msg.text.toLowerCase().replace('/start ', '');
        if (validURL(url) && url.indexOf('subito.it') !== -1) {
            subscribeToBot(id, url);
        } else {
            bot.sendMessage(id, 'La URL non è corretta oppure non è stata proprio inserita. Il comando giusto è /start URL_DI_SUBITO_QUI');
        }
    },
    list: (id) => {
        const message = listSubscriptions(id);
        bot.sendMessage(id, message);
    }
}

bot.on('message', (msg) => {
    const { id } = msg.chat

    /**
     * HELP COMMAND
     * 
     * Return every other commands available
     */

    if (isValidCommand(msg, '/help')) {
        commands.help(id);
        return true;
    }

    /**
     * START COMMAND
     * 
     * Iscrive un utente
     */
    if (isValidCommand(msg, '/start')) {
        commands.start(id, msg);
        return true;
    }

    if (isValidCommand(msg, '/list')) {
        commands.list(id);
        return true;
    }

    /**
     * CANCEL COMMAND
     * 
     * Disiscrive un utente dalla lista.
     */

    if (isValidCommand(msg, '/cancel')) {
        unsubscribeFromBot(id);
        return true;
    }

    /**
     * DEFAULT COMMAND
     * 
     * Dato il return messo in ogni listener del comando. Se arrivo fino a qui vuol dire che nessun comando dato era valido. Invio il comando HELP.
     */

    commands.help(id);
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