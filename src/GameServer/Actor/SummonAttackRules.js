'use strict';

const PvpRules = invoke('GameServer/PvpRules');
const Arena = invoke('GameServer/World/ArenaCombatRules');

function isOwnedPlayable(target) {
    return target?.fetchIsSummon?.() === true || target?.fetchIsPet?.() === true
        || ['Summon', 'Pet'].includes(target?.fetchKind?.());
}

// C4 L2Summon.isAutoAttackable delegates to its owner. An ordinary Action
// must not treat a friendly servitor as an attackable monster.
function canAttack(actor, target, request = null) {
    if (!isOwnedPlayable(target) || !PvpRules.isPlayable(actor)) return true;
    const Threats = invoke('GameServer/Bot/AI/BotPvpThreats');
    const player = Threats.character(actor), owner = Threats.character(target);
    if (!player || !owner || (player !== owner && !Arena.canInteract(player, owner))) return false;
    if (utils.isInPeaceZone(actor.fetchLocX(), actor.fetchLocY())
        || utils.isInPeaceZone(target.fetchLocX(), target.fetchLocY())) return false;
    if (request?.ctrl === true || request?.ctrl === 1) return true;
    // Ordinary summon clicks delegate auto-attackability to the owner,
    // whose own peace zone can differ from the summon standing nearby.
    if (utils.isInPeaceZone(owner.fetchLocX(), owner.fetchLocY())) return false;
    const Risk = invoke('GameServer/Bot/AI/BotPvpRisk');
    if (player === owner || Risk.sameParty(player.session, owner.session)) return false;
    if (Arena.suppressConsequences(player, owner)) return true;
    if (Risk.sameClan(player, owner)) return false;
    const Pledge = invoke('GameServer/Network/Response/PledgeHelpers');
    const ally = Pledge.allyId(player);
    if (ally > 0 && ally === Pledge.allyId(owner)) return false;
    return owner.fetchPvpFlag?.() > 0 || owner.fetchKarma?.() > 0;
}

module.exports = { isOwnedPlayable, canAttack };
