const SendPacket = invoke('Packet/Send');

function charTemplates() {
    const packet = new SendPacket(0x17);
    const templates = invoke('GameServer/DataCache').classTemplates;
    const ids = [0, 10, 18, 25, 31, 38, 44, 49, 53];
    packet.writeD(ids.length);
    for (const id of ids) {
        const row = templates.find(item => item.classId === id);
        packet.writeD(row.template.race).writeD(id);
        for (const stat of ['str', 'dex', 'con', 'int', 'wit', 'men']) {
            packet.writeD(0).writeD(row.base[stat]).writeD(0);
        }
    }

    return packet.fetchBuffer();
}

module.exports = charTemplates;
