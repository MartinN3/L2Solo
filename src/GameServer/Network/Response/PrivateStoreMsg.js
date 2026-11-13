const SendPacket = invoke('Packet/Send');

function privateStoreMsg(actor, storeTitle) {
    // C4 PrivateStoreMsgSell: object id + the separate store message.
    // It is rendered by the client inside the black "Private Store - Sell"
    // badge, rather than as the character's title above its name.
    const packet = new SendPacket(0x9c);
    packet.writeD(actor.fetchId());
    packet.writeS(typeof storeTitle === 'string' ? storeTitle : actor.fetchTitle());
    // These C4 string packets have no checksum or payload padding. The browser
    // client consumes exactly the object id and terminated UTF-16 title.
    return packet.buffer;
}

module.exports = privateStoreMsg;
