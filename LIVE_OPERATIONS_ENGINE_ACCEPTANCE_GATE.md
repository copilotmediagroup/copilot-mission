# Live Operations Engine Acceptance Gate

1. Platform Admin opens Live Operations without errors.
2. Client creates a mission; Marketplace count and pipeline update.
3. Agency claims mission; ownership changes in real time.
4. Guard goes online; Online and Available counters update.
5. Guard is assigned and accepts; pipeline advances.
6. Start Route; Driving count becomes 1.
7. Arrive and complete checkpoints; event feed advances.
8. Complete mission; Completed Today increases and Guard returns Available.
9. Agency publishes report; Pending decreases and Published increases.
10. Refresh restores identical state.
11. Non-Platform users cannot execute the read RPC.
