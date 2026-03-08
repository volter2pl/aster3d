# Transport Ship Contracts

status: draft

## Purpose

Transport ships should not be regular ambient enemies.

They should exist as contract-only high-value targets that give the player:

- a clear mission objective
- a reason to leave the normal salvage loop
- access to high-tier progression materials
- a more tactical combat encounter than standard enemies

This system should turn transport ships into meaningful events rather than just another random spawn.

## Design Goals

- Make contracts worth more than ordinary scavenging.
- Give the player a strong reason to take on extra risk.
- Add mid- and late-game progression that cannot be solved by farming only normal salvage.
- Create a combat encounter that rewards movement and positioning.
- Tie contracts directly into the base economy and upgrade system.

## Core Concept

- The player accepts a transport ship contract at the base.
- Only then does a transport ship spawn into the world.
- The HUD shows a navigation indicator pointing toward the mission target.
- The mission is time-limited.
- The player must intercept and destroy the transport ship.
- After the kill, the player should still need to survive and return to base with the rewards.

The contract should feel like a focused hunt layered on top of the normal open-space gameplay loop.

## Why Transport Ships Are Contract-Only

Making transport ships contract-only has several advantages:

- they stay special and high-value
- the player understands why the target matters
- the game can safely offer better rewards
- a timer and navigation arrow make sense
- balance is easier than if they spawned randomly during normal play

This also prevents the normal world from becoming overcrowded with high-reward targets.

## Mission Flow

### 1. Accept Contract at Base

- The player docks at the base.
- A contract is offered for a transport ship interception.
- Accepting the contract spawns one specific transport ship target.

### 2. Hunt Phase

- A HUD arrow points toward the target.
- The mission has a time limit.
- The transport ship travels through space instead of chasing the player.
- The player must intercept it before the timer expires.

### 3. Combat Phase

- The target is tougher and more valuable than a normal enemy.
- The fight should reward movement and approach angles, not frontal rushing.

### 4. Recovery Phase

- After destroying the target, the player collects the dropped rewards.
- The player returns to base with the loot.
- The run keeps its risk/reward tension because the player can still die before banking rewards.

## Transport Ship Behavior

- It is slow and not very agile.
- Its nose always stays aligned with its travel direction.
- It does not turn to face the player.
- It does not behave like a dogfighter.
- It performs a pass through space instead of directly pursuing the player.

This makes it feel different from current enemy ships and supports the idea that it is a defended cargo vessel, not a fighter.

## Combat Behavior

The transport ship should be able to fire in every direction, not only forward.

This is intentional.

Reasoning:

- the ship keeps its nose pointed along its route
- it should not need to rotate like a fighter to defend itself
- omnidirectional fire makes the fight more dynamic
- the player is encouraged to stay mobile, strafe, and maneuver
- the player should not be able to simply fly straight at the nose and win easily

The goal is to create pressure through streams or bursts of defensive fire while the ship continues its route.

## Rewards

Destroying a transport ship should reward more than extra salvage alone.

The reward model should have two layers:

- normal reward: salvage
- strategic reward: a rare upgrade material

### Salvage Reward

- Transport ships should drop salvage.
- Their salvage payout should be higher than standard enemies.
- This can be implemented as multiple independent salvage drop rolls, similar to the idea for large asteroids.

This makes transport kills feel materially profitable in the short term.

### Rare Part Reward

- Transport ships should also drop a rare part.
- This rare part is the key long-term reward for taking contracts.
- The rare part should be required for high-tier upgrades.
- The rare part should be a guaranteed reward from a successful contract kill, not RNG.

This avoids frustration and makes every completed contract clearly meaningful.

## Upgrade Gating

Rare parts should be used to gate progression beyond early upgrades.

Suggested model:

- upgrade levels 1-3 use normal resources only
- upgrade levels 4+ require rare parts in addition to normal cost

This allows:

- smooth early progression through normal play
- stronger motivation to engage with contracts later
- meaningful separation between basic and advanced ship builds

## Economy Role

The transport contract system should complement, not replace, the standard salvage economy.

Normal play should still matter because it provides:

- salvage
- points
- basic upgrade progression

Contracts should provide:

- higher salvage potential
- rare parts for advanced upgrades
- focused mission structure

This keeps both systems relevant.

## Relationship to Salvage Loss on Death

This feature becomes much stronger if the player loses unbanked salvage on death.

That creates the full intended loop:

- the player accepts a valuable contract
- the player takes a real combat risk
- the player earns valuable loot
- the player still has to make it back alive

That final return trip is important because it preserves tension after the target is destroyed.

## Visual / HUD Requirements

- A contract prompt or action in the base UI
- A mission-active HUD state
- A navigation arrow or target pointer for the transport ship
- A visible timer for the contract
- A clear indication that the transport ship is a special target
- A clear indication that a rare part dropped after the kill

## Minimal Implementation Scope

The first implementation should aim for a clean, playable version of the system:

- one active contract at a time
- one transport ship target type
- one rare part resource type
- one timer per contract
- one HUD direction indicator
- guaranteed rare part drop on kill
- salvage drop from the transport ship
- no random ambient transport ship spawns

This keeps the system small enough to finish while still delivering its full gameplay value.

## Later Expansion Options

After the first version works, the system could expand with:

- multiple contract difficulties
- faster or tougher transport ship variants
- escorts
- bonus rewards for fast completion
- failed contract penalties
- multiple types of rare parts for different upgrade branches

These are optional. They should come only after the basic contract loop feels good.

## Current Recommendation

Implement transport ships as contract-only targets.

Each successful transport contract should provide:

- elevated salvage reward
- one guaranteed rare part
- access to advanced progression beyond basic upgrades

This makes transport ships worth the effort and gives them a clear place in the overall game loop.
