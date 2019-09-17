const mongoose = require('mongoose');

const Subscriber = new mongoose.Schema({
    telegramID: {
        type: Number,
        unique: true,
        required: true
    },
    topic: {
        type: [
            {
                url: String,
                items: [Object],
                _id: false
            }
        ]
    }
});

module.exports = mongoose.model('Subscriber', Subscriber);