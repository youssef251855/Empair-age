# Firestore Security Specification - Empire Age

## 1. Core Data Invariants
- **Country Ownership lock**: Users can only modify a country if its `userId` matches the authenticated `request.auth.uid`.
- **Primary Resource protection**: A user cannot modify resource levels of another player's country.
- **Strict Keys**: Document creation must enforce specific required keys to prevent spoofing or injection.
- **Immutable Timestamps**: `createdAt` can never be updated and must initially match `request.time`.
- **Private Chats**: Direct messaging lines must only be readable by either the sender or the authenticated recipient.

## 2. The "Dirty Dozen" Payloads (Abridged Attacks)
1. **Unauthenticated Country Deletion**: Attacking `/countries/C01` without being logged in.
2. **Identity Spoofing**: Attempting to create a Country `/countries/C01` where `userId` is `another_user_uid`.
3. **Resource Poisoning**: Injecting negative values or `1000000000` gold on account creation.
4. **Alliance Hijacking**: Non-leader resetting alliance leadership status.
5. **Private Message Sniffing**: Reading `/messages/M01` intended as a private message to another player.
6. **Banning Self Bypass**: An standard player resetting `isBanned` to `false` on their profile.
7. **Retroactive Timestamp Injection**: Setting `createdAt` of a country to a historic timestamp instead of server time.
8. **Territory Theft**: Claiming someone else's territory on the client side without executing battle outcomes.
9. **Rogue Spy Insertion**: Creating a spy record `/spies/S01` assigned to observe another player on behalf of someone else.
10. **Global Chat Spoofing**: Writing a main global chat message indicating it was sent by another user's Country Name.
11. **Shadow Battle Report**: Forging a victorious battle report where the defender was completely wiped out.
12. **Double Harvest Exploit**: Triggering multiple harvest timestamps outside of the standard loop boundaries.

All these attacks will be explicitly rejected by our robust Firestore Security Rules.
