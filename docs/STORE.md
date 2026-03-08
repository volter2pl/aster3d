# Store and Upgrade System

status: draft

## Purpose

The current base already supports two simple actions:

- sell collected salvage for points
- repair shields using points

That is a good starting point, but it is not yet a real store / progression system.

Before transport ship contracts can deliver their full gameplay value, the game needs a proper store and upgrade layer. In particular, transport ship rare parts only make sense if the player can spend them on advanced upgrades.

## Why This Must Come First

Transport ship contracts can technically exist without a store rework, but they would be incomplete.

Without a real store and upgrade system:

- rare parts have no purpose
- high-tier progression does not exist
- the player has no meaningful long-term spending choices
- contracts become mostly a one-off source of extra salvage

Because of that, the store / upgrade system should be treated as a prerequisite for the full transport ship feature.

## Current State

The base currently supports:

- docking UI
- salvage sale for points
- shield repair for points

The base does not yet support:

- persistent upgrade levels
- cargo capacity upgrades
- shield capacity upgrades
- weapon upgrades
- rare-part spending
- a true shop interface with multiple upgrade actions

## Design Goals

- Turn the base into the center of long-term progression.
- Give the player meaningful choices about how to spend resources.
- Make salvage, points, and rare parts all have distinct roles.
- Support the risk/reward loop of returning safely to base.
- Provide a clean foundation for transport ship contracts and other future systems.

## Resource Model

The store should operate on three resource layers.

### 1. Salvage

Salvage is collected in space.

Role:

- primary run loot
- cargo-limited resource
- must be brought back alive

Salvage should remain the thing the player physically gathers during flight.

### 2. Points / Credits

Points are the banked currency earned from selling salvage.

Role:

- used for repairs
- used for early and mid-tier upgrades
- safe once the player returns to base and sells cargo

The game already has points. This should remain the main spendable currency in the store.

### 3. Rare Parts

Rare parts are special progression materials earned from transport ship contracts.

Role:

- used to unlock or buy high-tier upgrades
- not obtainable from normal asteroid farming
- required only for advanced progression

This keeps contracts strategically important.

## Upgrade Categories

The first version of the store should support three upgrade families.

### 1. Shields

- The player starts with very limited shield capacity.
- Shield upgrades increase maximum shield strength by a fixed amount each level.
- The first level should be cheap.
- Each next level costs 2x more than the previous one.

This creates strong survivability scaling while naturally slowing down the player over time through price growth.

Store implications:

- base UI must show current shield level
- base UI must show next cost
- the game must distinguish between current shield value and maximum shield value

### 2. Cargo

- The player starts with 3 cargo slots.
- Cargo upgrades increase maximum salvage capacity by one slot each level.
- Each next cargo slot costs 2x more than the previous one.

This makes cargo capacity part of progression instead of a fixed rule.

Store implications:

- base UI must show current cargo capacity
- salvage pickup logic must respect capacity
- HUD must show current cargo and max cargo

### 3. Weapons

The first weapon store version should support:

- fire rate upgrades
- projectile speed upgrades

Guidelines:

- the player should not start with the current high fire rate
- weapon upgrades should create visible changes in feel
- faster projectiles should visually stretch, gradually shifting from bolt-like shots toward laser-like shots

Store implications:

- upgrade levels must affect combat values in runtime
- UI should show current weapon level and next upgrade cost

## Upgrade Cost Structure

Recommended pattern:

- level 1 is intentionally affordable
- each next level costs 2x more than the previous one
- each level gives a fixed power increase

This should apply to shields and cargo first.

Weapons can use the same pattern unless testing shows they need a flatter curve.

## Rare Part Gating

Rare parts should not be needed for early progression.

Suggested rule:

- upgrade levels 1-3 require only points
- upgrade levels 4+ require points plus rare parts

This gives the game a clean two-phase progression model:

- early game: normal scavenging and simple upgrades
- advanced game: transport contracts unlock stronger builds

## Store UI Requirements

The base overlay should evolve from a simple station panel into a real store view.

Minimum UI requirements:

- current points
- current salvage in cargo
- current rare parts
- current shield level and next shield upgrade cost
- current cargo level / capacity and next cargo upgrade cost
- current weapon upgrade levels and next costs
- repair action
- sell salvage action

If transport contracts are added later, the base UI can also host:

- accept contract action
- active contract status
- contract reward preview

## Runtime / Systems Requirements

The store requires game-state changes beyond UI.

At minimum the game needs:

- persistent upgrade level fields in game state
- derived combat and ship stats based on those levels
- max shield separate from current shield
- max cargo separate from current cargo
- purchase validation
- cost calculation per upgrade level
- a way to track rare parts

## Save / Persistence Recommendation

If the game is expected to be replayed across browser sessions, the store should eventually persist progression.

Likely storage:

- `localStorage`

Suggested persisted values:

- shield upgrade level
- cargo upgrade level
- weapon upgrade levels
- current banked points
- current rare parts
- control settings can remain in their existing storage path

This is not strictly required for the first implementation, but the data model should be designed so persistence can be added cleanly.

## Relationship to Transport Ship Contracts

Transport ship contracts should be implemented after the store is capable of consuming rare parts.

That means the store should be able to:

- display rare parts
- track rare part inventory
- require rare parts for high-tier upgrades

Once that exists, transport ships can deliver a guaranteed rare part and immediately fit into the progression loop.

## Minimal Prerequisite Scope

Before implementing transport ship contracts, the store system should support at least:

- points as a banked currency
- shield upgrades with scaling costs
- cargo upgrades with scaling costs
- basic weapon upgrades
- rare part inventory in game state
- high-tier upgrade requirements that include rare parts
- updated base UI for buying upgrades

This is the minimum version that makes contract rewards meaningful.

## Recommended Build Order

1. Refactor current station state into a more formal store state.
2. Add upgrade data for shields, cargo, and weapons.
3. Separate current shield from max shield.
4. Separate collected cargo from cargo capacity.
5. Add purchase actions and upgrade costs in the base UI.
6. Add rare part inventory and high-tier upgrade requirements.
7. After that, implement transport ship contracts.

## Current Recommendation

Yes: for the transport ship concept in `docs/TRANSPORT_SHIP.md` to work properly, the store and upgrade system should be implemented first.

The transport contract feature can then plug into a progression system that already knows how to:

- reward the player
- gate advanced upgrades
- create meaningful spending decisions
- justify the existence of rare parts
