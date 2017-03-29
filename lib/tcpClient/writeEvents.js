const debug = require('debug')('geteventstore:writeEvents');
const connectionManager = require('./connectionManager');
const client = require('eventstore-node');
const Promise = require('bluebird');
const assert = require('assert');
const _ = require('lodash');

const baseErr = 'Write Events - ';

module.exports = config => (streamName, events, options) => Promise.resolve().then(() => {
    assert(streamName, `${baseErr}Stream Name not provided`);
    assert(events, `${baseErr}Events not provided`);
    assert.equal(true, events.constructor === Array, `${baseErr}Events should be an array`);

    if (events.length === 0) return;

    options = options || {};
    options.transactionWriteSize = options.transactionWriteSize || 50;
    options.expectedVersion = options.expectedVersion || -2;

    const eventsToWrite = _.map(events, ev => client.createJsonEventData(ev.eventId, ev.data, ev.metadata, ev.eventType));

    return connectionManager.create(config).then(connection => connection.startTransaction(streamName, options.expectedVersion, config.credentials).then(transaction => {
        const eventChunks = _.chunk(eventsToWrite, options.transactionWriteSize);
        return Promise.each(eventChunks, events => transaction.write(events)).then(() => transaction.commit().then(result => {
            debug('', 'Result: %j', result);
            return result;
        })).catch(err => {
            transaction.rollback();
            throw err;
        });
    }));
});