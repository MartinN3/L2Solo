const assert = require('node:assert/strict');
require('../src/Global');

const enchantResult = invoke('GameServer/Network/Response/EnchantResult');
const Enchant = invoke('GameServer/Enchant');
const enchantRequest = invoke('GameServer/Network/Request/EnchantItem');
const Frame = invoke('Packet/Frame');

// C4 EnchantResult is exactly one opcode plus one signed 32-bit result. Extra
// padding makes the strict client reject the response before closing the dialog.
for (const code of [0, 1, 2]) {
    const packet = enchantResult(code);
    assert.equal(packet.length, 5, `result ${code} must not contain padding`);
    assert.equal(packet[0], 0x81);
    assert.equal(packet.readInt32LE(1), code);
    assert.deepEqual(Frame.body(Frame.pack(packet)), packet, 'wire framing must preserve the exact unpadded response');
}

(async () => {
    const originalEnchant = Enchant.enchant;
    try {
        const seen = [];
        Enchant.enchant = async (_session, objectId) => { seen.push(objectId); };
        for (const objectId of [1234, -1]) {
            const request = Buffer.alloc(5);
            request[0] = 0x58;
            request.writeInt32LE(objectId, 1);
            enchantRequest({}, request);
        }
        enchantRequest({}, Buffer.from([0x58, 1, 2, 3]));
        assert.deepEqual(seen, [1234, -1], 'selection/cancel object ids reach the handler; truncated requests do not');
    } finally {
        Enchant.enchant = originalEnchant;
    }

    const packets = [];
    const session = {
        actor: { backpack: { fetchItemRaw() { return null; } } },
        activeEnchantItem: { itemId: 42, selfId: 729 },
        dataSendToMe(packet) { packets.push(packet); }
    };
    const result = await Enchant.enchant(session, -1);
    assert.equal(result.result, 'invalid');
    assert.equal(session.activeEnchantItem, null, 'cancellation clears the active scroll selection');
    assert.equal(packets.length, 1);
    assert.deepEqual(packets[0], enchantResult(2));
    console.log('Enchant result packet and request/cancellation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
