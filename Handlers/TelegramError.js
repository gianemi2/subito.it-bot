class TelegramError {
    constructor(code) {
        this.type = "telegram-error-handler"
        this.code = code
        switch (this.code) {
            case 0:
                this.message = "L'utente non esiste"
                break;
            case 1:
                // Il link che l'utente sta inserendo è già esistente.
                this.message = "⚠️ Hey! Sembra che il link che stai inserendo è già stato inserito prima.\nEcco la lista dei topic che stai seguendo!"
                break;
            case 2:
                this.message = "Il topic richiesto non esiste."
                break;
            default:
                this.message = "C'è stato un errore strano 🤪"

        }
    }
}
module.exports = TelegramError;