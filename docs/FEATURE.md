# Feature Ideas

## Core Loop Direction

The game should revolve around a simple risk/reward loop:

1. Leave the base and collect salvage.
2. Stay out longer to earn more, but risk losing your haul.
3. Return to base to sell salvage, repair, and buy upgrades.
4. Take on higher-value targets and repeat.

This keeps the game focused on tension, progression, and player decisions rather than pure score farming.

## Planned Features

### 1. Shield Upgrades

- The player starts with very limited shield capacity and can buy stronger shields at the base.
- The first shield upgrade should be cheap.
- Each next shield upgrade costs 2x more than the previous one.
- Every shield upgrade adds the same amount of protection.
- The growing price should naturally slow progression over time.

Visual feedback ideas:

- subtle canopy tint / shield color on the cockpit glass
- a visible mesh or reinforcement pattern suggesting armored glass

### 2. Cargo Upgrades

- The player starts with only 3 cargo slots.
- Additional cargo slots can be purchased at the base.
- Each next cargo slot costs 2x more than the previous one.

This creates a clear economy choice between survivability and profit potential.

### 3. Weapon Upgrades

- The player should not start with the current high fire rate.
- Weapon upgrades can improve:
  - fire rate
  - projectile speed

Projectile speed should also have visual impact:

- slow projectiles look like compact bolts
- faster projectiles become stretched and start to resemble lasers

### 4. Large Resource Asteroids

- Add asteroid size tiers, for example 1x, 2x, and 3x.
- Larger asteroids have more health.
- Larger asteroids have visible colored mineral deposits.
- Each size tier above the smallest should have its own deposit color.
- Larger asteroids should have multiple independent salvage drop rolls.

Example direction:

- medium asteroid: 2 independent salvage rolls
- large asteroid: 3 independent salvage rolls

This allows lucky high-yield kills without making rewards fully guaranteed.

### 5. Transport Ship Contracts

- The player can accept a contract at the base to hunt a transport ship.
- Transport ships only appear after the contract is accepted.
- A navigation indicator should point the player toward the mission target.
- The mission should be time-limited.

Transport ship behavior:

- They are slow and not very agile, similar to current minion ships.
- They do not turn to face the player.
- Their nose always stays aligned with their travel direction.
- They pass through the sector instead of actively chasing the player.
- Destroying them should give better salvage potential than standard enemies.
- Their salvage payout should come from multiple independent drop rolls.

Combat behavior:

- transport ships can fire in every direction instead of only forward
- this is intentional and fits their role as ships that keep moving instead of dogfighting
- it should force the player to stay mobile, maneuver around the ship, and avoid streams of fire instead of simply flying straight at it

This gives runs more structure than free-form scavenging alone.

### 6. Salvage Loss on Death

- If the player's shields drop to zero and they lose a life, they also lose all unbanked salvage.

This is a key part of the intended tension:

- staying out longer becomes dangerous
- returning to base becomes a meaningful decision
- cargo capacity becomes more valuable

## Design Notes

- Exponential pricing is good for long-term scaling, but the first few upgrade levels should stay affordable.
- The economy should make the player choose between shields, cargo, and weapon power.
- High-value targets such as large asteroids and transport ships should feel tempting because they can produce multi-salvage rewards.
