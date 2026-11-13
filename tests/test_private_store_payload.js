const assert = require('assert');

require('../src/Global');

const ServerResponse = invoke('GameServer/Network/Response');

const actor = {
    fetchId: () => 1001,
    fetchTitle: () => '',
    fetchPrivateStore: () => ({ items: [] }),
    backpack: {
        fetchItems: () => [],
        fetchItemRaw: () => null,
        fetchTotalAdena: () => 0
    }
};

function assertExactPayload(packet, length, description) {
    assert.strictEqual(packet.length, length, `${description} must not include trailing padding/checksum bytes`);
}

function assertTerminatedTitle(packet, description) {
    assert.strictEqual(packet.readInt32LE(1), actor.fetchId(), `${description} object id`);
    let end = 5;
    while (end + 1 < packet.length && (packet[end] !== 0 || packet[end + 1] !== 0)) end += 2;
    assert(end + 1 < packet.length, `${description} must include a UTF-16 terminator`);
    assertExactPayload(packet, end + 2, description);
}

assertTerminatedTitle(ServerResponse.privateStoreMsg(actor, 'Sell title'), 'PrivateStoreMsgSell');
assertTerminatedTitle(ServerResponse.privateStoreBuyMsg(actor, 'Buy title'), 'PrivateStoreMsgBuy');
assertExactPayload(ServerResponse.privateStoreManageListSell(actor, { items: [] }), 21, 'PrivateStoreManageListSell');
assertExactPayload(ServerResponse.privateStoreManageListBuy(actor, { items: [] }), 17, 'PrivateStoreManageListBuy');
assertExactPayload(ServerResponse.privateStoreListSell(actor, actor), 17, 'PrivateStoreListSell');
assertExactPayload(ServerResponse.privateStoreListBuy(actor, [], 0), 13, 'PrivateStoreListBuy');

console.log('C4 private-store payload tests passed');
