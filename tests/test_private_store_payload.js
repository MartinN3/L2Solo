const assert = require('assert');
const fs = require('fs');

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
const item = {
    fetchId: () => 70001,
    fetchSelfId: () => 1864,
    fetchAmount: () => 5,
    fetchClass2: () => 5,
    fetchPrice: () => 75,
    fetchSlot: () => 0,
    fetchEnchantLevel: () => 0,
    fetchEquipped: () => false,
    isWearable: () => false
};
const stockedActor = {
    ...actor,
    fetchPrivateStore: () => ({ items: [{ objectId: item.fetchId(), selfId: item.fetchSelfId(), count: 2, price: 62 }] }),
    backpack: {
        fetchItems: () => [item],
        fetchItemRaw: () => item,
        fetchTotalAdena: () => 5000
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
const manageSell = ServerResponse.privateStoreManageListSell(stockedActor, stockedActor.fetchPrivateStore());
const manageBuy = ServerResponse.privateStoreManageListBuy(stockedActor, stockedActor.fetchPrivateStore());
const sellList = ServerResponse.privateStoreListSell(stockedActor, actor);
const buyList = ServerResponse.privateStoreListBuy(actor, [{ item, amount: 2, price: 62 }], 5000);
assertExactPayload(manageSell, 85, 'PrivateStoreManageListSell');
assertExactPayload(manageBuy, 39, 'PrivateStoreManageListBuy');
assertExactPayload(sellList, 51, 'PrivateStoreListSell');
assertExactPayload(buyList, 47, 'PrivateStoreListBuy');

if (process.argv.includes('--export-fixtures')) {
    const fixtures = {
        privateStoreMsgSell: ServerResponse.privateStoreMsg(actor, 'Sell title').toString('hex'),
        privateStoreMsgBuy: ServerResponse.privateStoreBuyMsg(actor, 'Buy title').toString('hex'),
        privateStoreManageListSell: manageSell.toString('hex'),
        privateStoreManageListBuy: manageBuy.toString('hex'),
        privateStoreListSell: sellList.toString('hex'),
        privateStoreListBuy: buyList.toString('hex')
    };
    fs.writeFileSync('/tmp/l2solo-private-store-fixtures.json', `${JSON.stringify(fixtures, null, 2)}\n`);
}

console.log('C4 private-store payload tests passed');
