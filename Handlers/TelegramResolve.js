class TelegramResolve {
    constructor(code, content = false) {
        this.type = "telegram-success-handler"
        this.code = code
        switch (this.code) {
            case 0:
                // Utente creato correttamente!
                this.message = "Utente creato correttamente"
                break;
            case 1:
                // Lista dei topic seguiti aggiornata!
                this.message = "Lista topic aggiornata."
                break;
            case 2:
                // L'utente ha richiesto la lista dei topic!
                if (content) {
                    this.message = "Lista dei topic richiesta: \n\n" + content;
                } else {
                    this.message = "Nessun topic attivo. Aggiungine uno usando il comando /start"
                }
                break;
            default:
                this.message = "C'è stato un errore strano 🤪"

        }
    }
}
module.exports = TelegramResolve;