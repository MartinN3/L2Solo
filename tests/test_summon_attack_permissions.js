'use strict';

const assert = require('node:assert/strict');
require('../src/Global');
const World = invoke('GameServer/World/World');
const Rules = invoke('GameServer/Actor/SummonAttackRules');
const AttackExec = invoke('GameServer/Actor/Generics/AttackExec');
const Select = invoke('GameServer/Actor/Generics/Select');
const SkillExec = invoke('GameServer/Actor/Generics/SkillExec');
const SkillUse = invoke('GameServer/Network/Request/SkillUse');
const Generics = invoke(path.actor);
const Attack = invoke('GameServer/Actor/Attack');
const State = invoke('GameServer/Model/State');
const Formulas = invoke('GameServer/Formulas');
const PvpFlag = invoke('GameServer/Actor/PvpFlag');
const Arena = invoke('GameServer/World/ArenaCombatRules');
const Pledge = invoke('GameServer/Network/Response/PledgeHelpers');
const { registerSessions } = require('./helpers/worldSessions');
const drain = () => new Promise(setImmediate);

function player(id, bot = false) {
    const actor = { x: 0, flag: 0, karma: 0, selected: 1000001,
        state: new State(), effects: {}, fetchId: () => id, fetchLevel: () => 20,
        fetchLocX() { return this.x; }, fetchLocY: () => 0, fetchLocZ: () => 0,
        fetchPvpFlag() { return this.flag; }, fetchKarma() { return this.karma; },
        fetchClanId() { return this.clan || 0; }, fetchAllyId() { return this.ally || 0; }, fetchRadius: () => 8,
        fetchHead: () => 0, fetchCollectiveAtkSpd: () => 333,
        fetchDestId() { return this.selected; }, setDestId(id) { this.selected = id; },
        isDead: () => false, isBlocked: () => false, statusUpdateVitals() {},
        backpack: { fetchTotalWeaponKind: () => 'Weapon.Sword' } };
    const packets = [], arrivals = [];
    const session = { actor, accountId: `${bot ? 'bot' : 'player'}_${id}`,
        dataSendToMe: packet => packets.push(packet), dataSendToMeAndOthers: packet => packets.push(packet) };
    actor.session = session;
    actor.automation = { scheduleAction(_s, _a, _target, _range, callback) { arrivals.push(callback); } };
    return { actor, session, packets, arrivals };
}

function summon(owner, pet = false) {
    return { x: 40, state: new State(), fetchId: () => 1000001, fetchLevel: () => 20,
        fetchKind: () => pet ? 'Pet' : 'Summon', fetchIsSummon: () => !pet, fetchIsPet: () => pet,
        fetchOwnerId: () => owner.actor.fetchId(), fetchAttackable: () => true,
        fetchLocX() { return this.x; }, fetchLocY: () => 0, fetchLocZ: () => 0,
        fetchRadius: () => 8, isDead: () => false };
}

(async () => {
    const saved = { user: World.user, npc: World.fetchNpc, item: World.fetchItem, lookup: World.fetchUser,
        attackRequest: Generics.attackRequest, peace: utils.isInPeaceZone, chance: Formulas.calcHitChance,
        flag: PvpFlag.attack, arena: Arena.canInteract, duel: Arena.suppressConsequences, ally: Pledge.allyId };
    try {
        utils.isInPeaceZone = x => x === 99999;
        Pledge.allyId = actor => actor.ally || 0;
        const attacker = player(2000001), owner = player(2000002, true);
        registerSessions([attacker.session, owner.session]);
        const target = summon(owner), pet = summon(owner, true);
        for (const victim of [target, pet]) {
            assert.equal(Rules.canAttack(attacker.actor, victim), false, 'white owned creatures need Ctrl');
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: true }), true, 'explicit force attack remains possible');
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: 1 }), true, 'native skill Ctrl integer is accepted');
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: 2 }), false, 'unknown numeric force values are not authority');
            owner.actor.flag = 1;
            assert.equal(Rules.canAttack(attacker.actor, victim), true, 'owner flag authorizes ordinary attack');
            owner.actor.x = 99999;
            assert.equal(Rules.canAttack(attacker.actor, victim), false, 'ordinary auto-attackability follows owner peace zone');
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: 1 }), true, 'force checks summon position rather than owner position');
            owner.actor.x = 0;
            owner.session.partyCompanion = true;
            owner.session.followPlayerSession = attacker.session;
            assert.equal(Rules.canAttack(attacker.actor, victim), false, 'party companion summon is protected even when owner is flagged');
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: true }), true, 'forced party attack retains C4 force behavior');
            delete owner.session.partyCompanion; delete owner.session.followPlayerSession;
            owner.actor.flag = 0; owner.actor.karma = 1;
            assert.equal(Rules.canAttack(attacker.actor, victim), true, 'hostile owner karma authorizes ordinary attack');
            victim.x = 99999;
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: true }), false, 'Ctrl cannot bypass target peace zone');
            victim.x = 40; attacker.actor.x = 99999;
            assert.equal(Rules.canAttack(attacker.actor, victim, { ctrl: true }), false, 'Ctrl cannot bypass attacker peace zone');
            attacker.actor.x = 0; owner.actor.karma = 0;
        }
        const own = summon(attacker);
        assert.equal(Rules.canAttack(attacker.actor, own), false, 'ordinary own-summon clicks do not attack');
        assert.equal(Rules.canAttack(attacker.actor, own, { ctrl: true }), true, 'explicit own-summon force request retains C4 behavior');
        assert.equal(Rules.canAttack(attacker.actor, { ...target, fetchOwnerId: () => 9999999 }, { ctrl: true }), false, 'unknown owners fail closed');
        Arena.canInteract = () => false;
        assert.equal(Rules.canAttack(attacker.actor, target, { ctrl: true }), false, 'force request respects arena isolation');
        Arena.canInteract = saved.arena;
        owner.actor.flag = 1;
        attacker.actor.clan = owner.actor.clan = 7;
        assert.equal(Rules.canAttack(attacker.actor, target), false, 'same-clan owner is protected outside a duel');
        Arena.suppressConsequences = () => true;
        assert.equal(Rules.canAttack(attacker.actor, target), true, 'opposing arena participants may fight even in the same clan');
        owner.session.partyCompanion = true; owner.session.followPlayerSession = attacker.session;
        assert.equal(Rules.canAttack(attacker.actor, target), false, 'ordinary party protection still precedes arena hostility');
        delete owner.session.partyCompanion; delete owner.session.followPlayerSession;
        Arena.suppressConsequences = saved.duel;
        attacker.actor.clan = owner.actor.clan = 0;
        attacker.actor.ally = owner.actor.ally = 9;
        assert.equal(Rules.canAttack(attacker.actor, target), false, 'allied owner is protected even when flagged');
        attacker.actor.ally = owner.actor.ally = 0;
        owner.actor.flag = 0;
        assert.equal(AttackExec.canAttackNpc({ fetchAttackable: () => true }), true, 'normal monster attacks are unchanged');

        let hits = 0, talks = 0;
        attacker.actor.attack = { meleeHit(_session, victim, request) { assert.equal(victim, target); assert.equal(request.ctrl, true); hits++; } };
        World.fetchNpc = async () => target;
        World.fetchUser = async () => { throw new Error('not a player'); };
        World.fetchItem = async () => { throw new Error('not an item'); };
        const oldTalk = World.npcTalk;
        World.npcTalk = () => talks++;
        try {
            Generics.attackRequest = AttackExec;
            owner.session.partyCompanion = true; owner.session.followPlayerSession = attacker.session;
            for (let i = 0; i < 3; i++) { Select(attacker.session, attacker.actor, { id: target.fetchId() }); await drain(); }
            assert.equal(attacker.arrivals.length, 0, 'normal repeated party-summon clicks never schedule an attack or talk');
            assert.equal(hits, 0); assert.equal(talks, 0);
            AttackExec(attacker.session, attacker.actor, { id: target.fetchId(), ctrl: true }); await drain();
            attacker.arrivals.shift()();
            assert.equal(hits, 1, 'direct force request reaches melee with its permission flag');
            delete owner.session.partyCompanion; delete owner.session.followPlayerSession;
            owner.actor.flag = 1;
            AttackExec(attacker.session, attacker.actor, { id: target.fetchId() }); await drain();
            owner.actor.flag = 0;
            attacker.arrivals.shift()();
            assert.equal(hits, 1, 'arrival rechecks an owner whose flag expired');
        } finally { World.npcTalk = oldTalk; }

        const attack = new Attack(), timers = [], damage = [];
        attacker.actor.attack = attack;
        attack.resolveMeleeTargets = () => [target];
        attack.prepareMeleeHit = () => ({ damage: 10, flags: 0 });
        attack.hit = (_s, _actor, victim) => damage.push(victim);
        attack.applyDamageAbsorb = () => {};
        attack.queueTimer = callback => timers.push(callback);
        Formulas.calcHitChance = () => true;
        PvpFlag.attack = () => false;
        owner.actor.flag = 1;
        attack.meleeHit(attacker.session, target);
        assert.equal(timers.length, 2);
        owner.session.partyCompanion = true; owner.session.followPlayerSession = attacker.session;
        timers.shift()();
        assert.equal(damage.length, 0, 'a party change while the swing is in flight prevents damage');
        timers.shift()();
        assert.equal(timers.length, 0, 'automatic repeat does not restart on a party summon');
        delete owner.session.partyCompanion; delete owner.session.followPlayerSession;
        attacker.actor.state.setHits(false);
        attack.meleeHit(attacker.session, target, { ctrl: true });
        timers.shift()();
        assert.equal(damage.length, 1);
        timers.shift()();
        assert.equal(timers.length, 2, 'forced permission is preserved on automatic repeat');
        target.x = 99999;
        timers.shift()();
        assert.equal(damage.length, 1, 'moving into peace zone revokes forced damage at impact');
        timers.shift()();
        assert.equal(timers.length, 0);
        attack.destructor();

        const poleAttack = new Attack(), poleTimers = [], poleDamage = [];
        const polePrimary = { ...target, x: 40, fetchId: () => 1000002,
            fetchIsSummon: () => false, fetchKind: () => 'Monster' };
        target.x = 40;
        owner.session.partyCompanion = true; owner.session.followPlayerSession = attacker.session;
        attacker.actor.state.setHits(false);
        attacker.actor.attack = poleAttack;
        poleAttack.resolveMeleeTargets = () => [polePrimary, target];
        poleAttack.prepareMeleeHit = () => ({ damage: 10, flags: 0 });
        poleAttack.hit = (_s, _actor, victim) => poleDamage.push(victim);
        poleAttack.applyDamageAbsorb = () => {};
        poleAttack.queueTimer = callback => poleTimers.push(callback);
        poleAttack.meleeHit(attacker.session, polePrimary, { ctrl: true });
        poleTimers.shift()();
        assert.deepEqual(poleDamage, [polePrimary], 'force on a primary target does not authorize secondary polearm damage to party summons');
        poleAttack.destructor();
        delete owner.session.partyCompanion; delete owner.session.followPlayerSession;

        target.x = 40; owner.actor.flag = 0;
        const skill = { fetchTargetKind: () => 'enemy', fetchDistance: () => 600,
            fetchSemantic: () => ({}), fetchSelfId: () => 54, fetchCalculatedHitTime: () => 0, fetchPassive: () => false };
        attacker.actor.skillset = { fetchSkill: () => skill };
        attacker.actor.state.setHits(false);
        let casts = 0;
        attacker.actor.attack = { validateSkillTarget: () => true,
            remoteHit(_s, victim, _skill, request) {
                assert.equal(victim, target); assert([true, 1].includes(request.ctrl)); casts++;
            } };
        owner.session.partyCompanion = true; owner.session.followPlayerSession = attacker.session;
        SkillExec(attacker.session, attacker.actor, { id: target.fetchId(), selfId: 54 }); await drain();
        assert.equal(attacker.arrivals.length, 0, 'an ordinary hostile skill never approaches a party summon');
        SkillExec(attacker.session, attacker.actor, { id: target.fetchId(), selfId: 54, ctrl: true }); await drain();
        attacker.arrivals.shift()();
        assert.equal(casts, 1, 'forced direct skill retains force permission');
        attacker.actor.skillRequest = data => SkillExec(attacker.session, attacker.actor, { ...data, id: target.fetchId() });
        const wireSkill = Buffer.alloc(10);
        wireSkill[0] = 0x2f; wireSkill.writeInt32LE(54, 1);
        SkillUse(attacker.session, wireSkill); await drain();
        assert.equal(attacker.arrivals.length, 0, 'native Ctrl=0 skill packet cannot attack party summon');
        wireSkill.writeInt32LE(1, 5);
        SkillUse(attacker.session, wireSkill); await drain();
        attacker.arrivals.shift()();
        assert.equal(casts, 2, 'native Ctrl=1 skill packet preserves explicit force permission');

        const castAttack = new Attack(), applied = [], paid = [];
        attacker.actor.attack = castAttack;
        castAttack.blockedPvpDefense = () => false;
        castAttack.checkParticipants = () => false;
        castAttack.resolveSkillTargets = () => [target];
        castAttack.consumeSkillItems = () => true;
        castAttack.payRemoteCast = () => paid.push(true);
        castAttack.captureShotState = () => ({});
        castAttack.consumeSkillCharges = () => true;
        castAttack.applyRemoteCastEffect = (_s, _a, victim) => applied.push(victim);
        castAttack.finishRemoteCast = () => {};
        const cast = { corpseTarget: false, mpCost: 0, magicSkill: false };
        castAttack.landRemoteCast(attacker.session, attacker.actor, target, skill, cast);
        assert.equal(applied.length, 0, 'party membership at landing rejects the hostile skill before damage');
        assert.equal(paid.length, 0, 'a rejected direct summon target does not consume cast payment');
        const RaidCurse = invoke('GameServer/RaidBoss/RaidCurse'), oldBlocked = RaidCurse.skillBlocked;
        RaidCurse.skillBlocked = () => false;
        try {
            castAttack.landRemoteCast(attacker.session, attacker.actor, target, skill, { ...cast, request: { ctrl: true } });
            assert.equal(applied.length, 1, 'forced direct skill remains authorized at landing');
            target.x = 99999;
            castAttack.landRemoteCast(attacker.session, attacker.actor, target, skill, { ...cast, request: { ctrl: true } });
            assert.equal(applied.length, 1, 'forced skill cannot land after target enters peace zone');
            target.x = 40;
            const monster = { ...target, fetchIsSummon: () => false, fetchKind: () => 'Monster' };
            castAttack.resolveSkillTargets = () => [target, monster];
            castAttack.landRemoteCast(attacker.session, attacker.actor, attacker.actor, skill, { ...cast, request: { ctrl: true } });
            assert.deepEqual(applied.slice(1), [monster], 'force on aura does not authorize hitting allied summons as secondary victims');
            castAttack.resolveSkillTargets = () => [target];
            const auraSelfEffect = { ...skill, fetchSemantic: () => ({ sourceTarget: 'aura', selfEffect: {} }) };
            const selfTargets = castAttack.remoteCastTargets(attacker.session, attacker.actor, attacker.actor, auraSelfEffect);
            assert.equal(selfTargets.selfEffectOnly, true, 'filtering protected summons preserves aura self-effect fallback');
            assert.deepEqual(selfTargets.executionTargets, [attacker.actor]);
        } finally { RaidCurse.skillBlocked = oldBlocked; }
        castAttack.destructor();
        console.log('Summon/pet click, force, party, owner, peace, arena and in-flight permission checks passed');
    } finally {
        World.user = saved.user; World.fetchNpc = saved.npc; World.fetchItem = saved.item; World.fetchUser = saved.lookup;
        Generics.attackRequest = saved.attackRequest; utils.isInPeaceZone = saved.peace;
        Formulas.calcHitChance = saved.chance; PvpFlag.attack = saved.flag; Arena.canInteract = saved.arena;
        Arena.suppressConsequences = saved.duel;
        Pledge.allyId = saved.ally;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
