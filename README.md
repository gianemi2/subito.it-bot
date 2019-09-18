# Subito.it bot

Imposta delle query di ricerca che desideri seguire. Il bot penserà a notificarti quando nuovi articoli verranno pubblicati. 

Potete iscrivervi al bot su telegram [cliccando qui](https://t.me/nonsubitobot).

## Installazione

È possibile creare una vostra instanza di questo bot per modificarlo o per aggiungere nuove funzioni. 

Sarebbe fantastico aggiungere nuove funzioni direttamente a questa repository tramite dei fork ma se volete potete creare un'instanza privata di vostra esclusiva proprietà.


### Creare un bot su Telegram e ottenere il Token
------

Ci sono moltissimi guide online su come creare un bot su Telegram e ottenerne il token. [Lascio comunque il link della documentazione ufficiale di Telegram dove potrete scendere più nel dettaglio.](https://core.telegram.org/bots#6-botfather)

### Preparare l'app di Heroku
------

Al momento spiegherò solo come hostare il bot su Heroku. In futuro aggiungerò una veloce guida per hostarlo anche in locale.

È necessario avere installata la [CLI di heroku](https://devcenter.heroku.com/articles/heroku-cli) ed effettuate il login ad essa seguendo la guida.


```
$ git clone https://github.com/gianemi2/subito.it-bot.git
$ cd subito.it-bot

$ heroku create
$ heroku config:set TOKEN=THE_TELEGRAM_TOKEN_FROM_BOTFATHER
$ git add -A
$ git commit -m "Ready to run on heroku"
$ git push heroku master
```

Quando tutto sarà pronto e settato correttamente potrete provare a inviare un messaggio al bot appena creato da botfather per vedere se risponde nel modo giusto.

## Prevenire il Dyno Sleeping su Heroku
Ringrazio [Emiliano Talamo](https://github.com/EmilianoTalamo/) per questa veloce soluzione per evitare che i Dyno di Heroku dopo un'ora senza richieste vadano in sleep.

Cito testualmente la sua guida:

Di default, le apps su Heroku vanno in riposo dopo 1 ora di inattività. Questo può essere evitato impostando i `Worker Dyno` invece che come `Web dyno`. Questo è già impostato nel Procfile, ma controlla bene che sia così anche nella dashboard di Heroku.

1. Vai alla tua [Dashboard di Heroku](https://dashboard.heroku.com) e seleziona la tua app.

2. Seleziona il tab `resources`.

![Resources Tab](https://i.imgur.com/vFMtJnN.jpg)

3. Togli la spunta da `WEB` (in caso ci sia) e mettila su `WORKER` (in caso non ci sia). Per gestire le spunte dovrete prima cliccare sulla matitina a destra.

![Check worker, uncheck web](https://i.imgur.com/LxpbJlN.jpg)

## Contribute
I pull requests sono i benvenuti. Per modifiche importanti cerca di aprire prima un issue così da poter discuterne prima insieme 😊

Please make sure to update tests as appropriate.

## Thanks to

🙏🏼 Grazie a [Emiliano Talamo](https://github.com/EmilianoTalamo/telegram-bot-node-and-heroku) per il boilerplate di un bot per Telegram fatto in Node.

🙏🏼 Grazie a [Yagop](https://github.com/yagop/node-telegram-bot-api) per le API per interfacciare semplicemente Telegram e Node.


## License
[MIT](LICENSE)