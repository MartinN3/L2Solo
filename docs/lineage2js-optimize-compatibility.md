# Lineage2JS optimize compatibility

This branch carries server-side compatibility changes for the browser client
fork's experimental integration branch
[`feat/l2solo-local-integration`](https://github.com/MartinN3/Lineage2JS/tree/feat/l2solo-local-integration),
which is based on [`optimize`](https://github.com/MartinN3/Lineage2JS/tree/optimize).
It adjusts the C4 login handshake and several response packet layouts expected
by that client, plus character-template data used during creation.

The branch also allows a mounted strider to use its full movement speed even
when its level is much higher than the rider. The attack penalty for a large
pet-to-rider level gap remains. This movement-speed choice is a local gameplay
preference for this browser-client setup; it is not required by the C4 protocol.

The changes do not bundle the browser client or change its source. Run this
server branch together with the linked client integration branch when testing
the integration.
