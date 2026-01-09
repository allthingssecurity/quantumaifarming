// Vegetable Gatherer - A Top-Down Collection Game
// Find vegetables while avoiding dangerous insects!

const TILE_SIZE = 32;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 30;
const PLAYER_SPEED = 140;
const MAX_LIVES = 5;
const INFECTION_DAMAGE_RATE = 0.5; // Health lost per second when infected
const INFECTION_DURATION = 5000; // ms

// Spritesheet configuration
const SPRITE_FRAME_W = 256;
const SPRITE_FRAME_H = 256;
const SPRITE_COLS = 4;
const SPRITE_ROWS = 4;

// Frame sizes for AI-generated tilesets
const WORLD_TILE_W = Math.floor(1936 / 7);
const WORLD_TILE_H = Math.floor(544 / 2);
const PROPS_TILE_W = Math.floor(1408 / 5);
const PROPS_TILE_H = Math.floor(768 / 2);

// New props tileset (1328x800, 5 cols x 3 rows)
const NEW_PROPS_TILE_W = Math.floor(1328 / 5);  // ~265
const NEW_PROPS_TILE_H = Math.floor(800 / 3);   // ~267

// Vegetable types with Quantum/AI concepts
const VEGETABLES = {
    carrot: {
        color: 0xff6b35, points: 10, name: 'Carrot', heals: 0,
        concept: 'Superposition', description: 'A qubit can exist in multiple states simultaneously!'
    },
    tomato: {
        color: 0xff4444, points: 15, name: 'Tomato', heals: 0.5,
        concept: 'Entanglement', description: 'Quantum particles can be mysteriously connected!'
    },
    cabbage: {
        color: 0x90ee90, points: 20, name: 'Cabbage', heals: 1,
        concept: 'AI Agent', description: 'Autonomous systems that perceive and act!'
    },
    eggplant: {
        color: 0x9932cc, points: 25, name: 'Eggplant', heals: 0,
        concept: 'LLM Reasoning', description: 'Large Language Models can chain thoughts!'
    },
    corn: {
        color: 0xffd700, points: 30, name: 'Corn', heals: 0,
        concept: 'Quantum Gates', description: 'Operations that transform qubit states!'
    },
    pumpkin: {
        color: 0xff8c00, points: 50, name: 'AIQNEX Crystal', heals: 2, special: true,
        concept: 'Quantum Advantage', description: 'Where quantum computers outperform classical ones!'
    }
};

// Insect types
const INSECTS = {
    bee: { color: 0xffd700, speed: 60, damage: 1, name: 'Bee' },
    beetle: { color: 0x2f4f4f, speed: 40, damage: 1.5, name: 'Beetle' },
    wasp: { color: 0xff4500, speed: 80, damage: 2, name: 'Wasp' }
};

const BLOCKED_WORLD_TILES = [8, 9, 10, 11, 12];
const BLOCKED_PROP_TILES = [0, 2, 3, 4, 6, 7, 8, 9];

// Sound Manager
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playCollect() {
        this.playTone(523, 0.1, 'sine', 0.2);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 50);
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.2), 100);
    }

    playFootstep() {
        this.playTone(100 + Math.random() * 50, 0.05, 'triangle', 0.1);
    }

    playWin() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.25), i * 150);
        });
    }

    playHurt() {
        this.playTone(200, 0.15, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(150, 0.2, 'sawtooth', 0.2), 100);
    }

    playInfected() {
        this.playTone(300, 0.1, 'square', 0.15);
    }

    playHeal() {
        this.playTone(440, 0.1, 'sine', 0.2);
        setTimeout(() => this.playTone(550, 0.15, 'sine', 0.2), 80);
    }

    playGameOver() {
        const notes = [400, 350, 300, 200];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.4, 'sawtooth', 0.25), i * 200);
        });
    }

    playBuzz() {
        this.playTone(150 + Math.random() * 50, 0.03, 'sawtooth', 0.05);
    }
}

const soundManager = new SoundManager();

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.rectangle(width / 2, height / 2, width, height, 0x1a472a);

        this.add.text(width / 2, height / 2 - 80, '🥕 Vegetable Gatherer 🥕', {
            font: 'bold 28px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 10);

        const progressBar = this.add.graphics();

        this.add.text(width / 2, height / 2 + 50, 'Loading farm...', {
            font: '16px Arial',
            fill: '#88cc88'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x4ade80, 1);
            progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 8);
        });

        this.load.spritesheet('world_tiles', 'tileset_world_32x32.png', {
            frameWidth: WORLD_TILE_W,
            frameHeight: WORLD_TILE_H
        });

        this.load.spritesheet('prop_tiles', 'tileset_props_32x32.png', {
            frameWidth: PROPS_TILE_W,
            frameHeight: PROPS_TILE_H
        });

        // Load new nicer props
        this.load.spritesheet('new_props', 'tileset_props_new.png', {
            frameWidth: NEW_PROPS_TILE_W,
            frameHeight: NEW_PROPS_TILE_H
        });

        this.load.spritesheet('player', 'farmer_spritesheet.png', {
            frameWidth: SPRITE_FRAME_W,
            frameHeight: SPRITE_FRAME_H
        });

        // Load AIQNEX logo
        this.load.image('aiqnex_logo', 'aiqnex_logo.png');

        this.load.json('mapData', 'world_map_village.json');
    }

    create() {
        soundManager.init();
        this.input.once('pointerdown', () => soundManager.resume());
        this.input.keyboard.once('keydown', () => soundManager.resume());

        this.scene.start('GameScene');
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.wasd = null;
        this.mapData = null;
        this.vegetables = null;
        this.insects = null;
        this.collectedVegetables = {};
        this.score = 0;
        this.totalVegetables = 0;
        this.lives = MAX_LIVES;
        this.health = 1; // 0-1 per life
        this.isInfected = false;
        this.infectionTimer = 0;
        this.isGameOver = false;
        this.footstepTimer = 0;
        this.buzzTimer = 0;
        this.currentLevel = 1;

        // Touch input state
        this.touchInput = {
            up: false,
            down: false,
            left: false,
            right: false,
            collect: false
        };
    }

    // Level configurations
    getLevelConfig() {
        const levels = {
            1: {
                name: 'Green Meadow',
                vegetables: 15,
                insects: 4,
                insectSpeedMult: 0.8,
                infectionDuration: 6000
            },
            2: {
                name: 'Busy Farm',
                vegetables: 20,
                insects: 8,
                insectSpeedMult: 1.0,
                infectionDuration: 5000
            },
            3: {
                name: 'Danger Zone',
                vegetables: 30,
                insects: 15,
                insectSpeedMult: 1.3,
                infectionDuration: 4000
            }
        };
        return levels[this.currentLevel] || levels[3];
    }

    create(data) {
        this.mapData = this.cache.json.get('mapData');

        // Get level from passed data or start at 1
        if (data && data.level) {
            this.currentLevel = data.level;
        }
        if (data && data.score) {
            this.score = data.score;
        } else {
            this.score = 0;
        }

        const levelConfig = this.getLevelConfig();

        // Reset game state
        this.lives = MAX_LIVES;
        this.health = 1;
        this.isInfected = false;
        this.isGameOver = false;

        Object.keys(VEGETABLES).forEach(veg => {
            this.collectedVegetables[veg] = 0;
        });

        this.createVegetableTextures();
        this.createInsectTextures();
        this.createGroundLayer();
        this.createDecorLayer();
        this.createCollisionLayer();
        this.spawnDecorations();
        this.spawnVegetables();
        this.createPlayerAnimations();
        this.spawnInsects();
        this.createPlayer();
        this.setupCamera();
        this.setupControls();
        this.createUI();
        this.createParticles();

        // Update HTML HUD with level info
        const levelEl = document.getElementById('hud-level');
        if (levelEl) levelEl.textContent = `Level ${this.currentLevel}: ${levelConfig.name}`;

        // Create infection overlay
        this.infectionOverlay = this.add.rectangle(
            0, 0, 640, 480, 0x00ff00, 0
        ).setOrigin(0).setScrollFactor(0).setDepth(999);

        // Show level intro
        this.showLevelIntro();

        this.input.once('pointerdown', () => soundManager.resume());
    }

    showLevelIntro() {
        const levelConfig = this.getLevelConfig();

        const overlay = this.add.rectangle(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2,
            400, 200, 0x000000, 0.85
        ).setDepth(1500);

        const title = this.add.text(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2 - 50,
            `🌾 LEVEL ${this.currentLevel} 🌾`,
            { font: 'bold 28px Arial', fill: '#ffd700' }
        ).setOrigin(0.5).setDepth(1501);

        const name = this.add.text(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2 - 10,
            levelConfig.name,
            { font: 'bold 20px Arial', fill: '#88ff88' }
        ).setOrigin(0.5).setDepth(1501);

        const info = this.add.text(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2 + 30,
            `Collect ${levelConfig.vegetables} vegetables!\nAvoid ${levelConfig.insects} insects!`,
            { font: '14px Arial', fill: '#ffffff', align: 'center' }
        ).setOrigin(0.5).setDepth(1501);

        // Fade out after 2 seconds
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: [overlay, title, name, info],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    title.destroy();
                    name.destroy();
                    info.destroy();
                }
            });
        });
    }

    createVegetableTextures() {
        Object.entries(VEGETABLES).forEach(([type, config]) => {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            const cx = TILE_SIZE / 2;
            const cy = TILE_SIZE / 2;

            graphics.fillStyle(config.color, 1);

            switch (type) {
                case 'carrot':
                    graphics.fillTriangle(cx, cy + 8, cx - 4, cy - 4, cx + 4, cy - 4);
                    graphics.fillStyle(0x228b22, 1);
                    graphics.fillRect(cx - 2, cy - 8, 4, 6);
                    break;
                case 'tomato':
                    graphics.fillCircle(cx, cy, 8);
                    graphics.fillStyle(0x228b22, 1);
                    graphics.fillRect(cx - 2, cy - 10, 4, 4);
                    break;
                case 'cabbage':
                    graphics.fillCircle(cx, cy, 9);
                    graphics.fillStyle(0x32cd32, 1);
                    graphics.fillCircle(cx, cy, 6);
                    // Add healing indicator
                    graphics.fillStyle(0xffffff, 0.5);
                    graphics.fillCircle(cx + 3, cy - 3, 2);
                    break;
                case 'eggplant':
                    graphics.fillEllipse(cx, cy + 2, 8, 12);
                    graphics.fillStyle(0x228b22, 1);
                    graphics.fillRect(cx - 3, cy - 10, 6, 4);
                    break;
                case 'corn':
                    graphics.fillEllipse(cx, cy, 6, 12);
                    graphics.fillStyle(0x90ee90, 1);
                    graphics.fillTriangle(cx - 8, cy - 6, cx - 2, cy - 8, cx - 2, cy + 4);
                    graphics.fillTriangle(cx + 8, cy - 6, cx + 2, cy - 8, cx + 2, cy + 4);
                    break;
                case 'pumpkin':
                    graphics.fillCircle(cx, cy + 2, 10);
                    graphics.fillStyle(0x228b22, 1);
                    graphics.fillRect(cx - 2, cy - 10, 4, 6);
                    graphics.fillStyle(0x654321, 1);
                    graphics.fillRect(cx - 1, cy - 12, 2, 4);
                    // Healing cross
                    graphics.fillStyle(0xffffff, 0.6);
                    graphics.fillRect(cx - 1, cy - 2, 2, 6);
                    graphics.fillRect(cx - 3, cy, 6, 2);
                    break;
            }

            graphics.generateTexture(`veg_${type}`, TILE_SIZE, TILE_SIZE);
            graphics.destroy();
        });

        const sparkle = this.make.graphics({ x: 0, y: 0, add: false });
        sparkle.fillStyle(0xffff00, 1);
        sparkle.fillCircle(4, 4, 3);
        sparkle.generateTexture('sparkle', 8, 8);
        sparkle.destroy();
    }

    createInsectTextures() {
        Object.entries(INSECTS).forEach(([type, config]) => {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            const cx = 12;
            const cy = 12;

            if (type === 'bee') {
                // Bee body
                graphics.fillStyle(0xffd700, 1);
                graphics.fillEllipse(cx, cy, 8, 6);
                // Stripes
                graphics.fillStyle(0x000000, 1);
                graphics.fillRect(cx - 2, cy - 3, 2, 6);
                graphics.fillRect(cx + 2, cy - 3, 2, 6);
                // Wings
                graphics.fillStyle(0xaaddff, 0.7);
                graphics.fillEllipse(cx - 4, cy - 4, 4, 6);
                graphics.fillEllipse(cx + 4, cy - 4, 4, 6);
            } else if (type === 'beetle') {
                // Beetle body
                graphics.fillStyle(0x2f4f4f, 1);
                graphics.fillEllipse(cx, cy, 10, 8);
                // Shell line
                graphics.fillStyle(0x1a3a3a, 1);
                graphics.fillRect(cx - 1, cy - 5, 2, 10);
                // Eyes
                graphics.fillStyle(0xff0000, 1);
                graphics.fillCircle(cx - 3, cy - 3, 2);
                graphics.fillCircle(cx + 3, cy - 3, 2);
            } else if (type === 'wasp') {
                // Wasp body
                graphics.fillStyle(0xff4500, 1);
                graphics.fillEllipse(cx, cy, 6, 10);
                // Stripes
                graphics.fillStyle(0x000000, 1);
                graphics.fillRect(cx - 4, cy - 2, 8, 2);
                graphics.fillRect(cx - 4, cy + 2, 8, 2);
                // Wings
                graphics.fillStyle(0xaaddff, 0.7);
                graphics.fillEllipse(cx - 5, cy - 2, 5, 4);
                graphics.fillEllipse(cx + 5, cy - 2, 5, 4);
                // Stinger
                graphics.fillStyle(0x000000, 1);
                graphics.fillTriangle(cx, cy + 8, cx - 2, cy + 5, cx + 2, cy + 5);
            }

            graphics.generateTexture(`insect_${type}`, 24, 24);
            graphics.destroy();
        });

        // Poison particle
        const poison = this.make.graphics({ x: 0, y: 0, add: false });
        poison.fillStyle(0x00ff00, 1);
        poison.fillCircle(3, 3, 3);
        poison.generateTexture('poison', 6, 6);
        poison.destroy();
    }

    createGroundLayer() {
        const groundData = this.mapData.layers.ground;
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tileId = groundData[y][x];
                const sprite = this.add.sprite(
                    x * TILE_SIZE + TILE_SIZE / 2,
                    y * TILE_SIZE + TILE_SIZE / 2,
                    'world_tiles',
                    tileId
                );
                sprite.setDisplaySize(TILE_SIZE + 0.5, TILE_SIZE + 0.5);
                sprite.setDepth(0);
            }
        }
    }

    createDecorLayer() {
        const decorData = this.mapData.layers.decor;
        this.decorSprites = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tileId = decorData[y][x];
                if (tileId !== null) {
                    const sprite = this.add.sprite(
                        x * TILE_SIZE + TILE_SIZE / 2,
                        y * TILE_SIZE + TILE_SIZE / 2,
                        'prop_tiles',
                        tileId
                    );
                    sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
                    sprite.setDepth(tileId === 1 ? 100 : 5);
                    this.decorSprites.push({ sprite, x, y, tileId });
                }
            }
        }
    }

    createCollisionLayer() {
        this.collisionGroup = this.physics.add.staticGroup();
        const groundData = this.mapData.layers.ground;
        const decorData = this.mapData.layers.decor;
        this.blockedTiles = new Set();

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const groundTileId = groundData[y][x];
                const decorTileId = decorData[y][x];
                let blocked = false;

                if (BLOCKED_WORLD_TILES.includes(groundTileId)) {
                    this.addCollisionRect(x, y);
                    blocked = true;
                }

                if (decorTileId !== null && BLOCKED_PROP_TILES.includes(decorTileId)) {
                    if (decorTileId !== 1) {
                        this.addCollisionRect(x, y);
                    }
                    blocked = true;
                }

                if (blocked) {
                    this.blockedTiles.add(`${x},${y}`);
                }
            }
        }

        if (this.mapData.objects) {
            for (const obj of this.mapData.objects) {
                if (obj.collidable && obj.sprite !== 'tree_canopy') {
                    this.addCollisionRect(obj.x, obj.y);
                    this.blockedTiles.add(`${obj.x},${obj.y}`);
                }
            }
        }

        // Add rectangular collision zones from map data
        if (this.mapData.collisions && this.mapData.collisions.rectangles) {
            for (const rect of this.mapData.collisions.rectangles) {
                for (let y = rect.y; y < rect.y + rect.height; y++) {
                    for (let x = rect.x; x < rect.x + rect.width; x++) {
                        this.addCollisionRect(x, y);
                        this.blockedTiles.add(`${x},${y}`);
                    }
                }
            }
        }

        // Add border collision to prevent going off map edges
        for (let x = 0; x < MAP_WIDTH; x++) {
            this.addCollisionRect(x, -1);  // Top border
            this.addCollisionRect(x, MAP_HEIGHT); // Bottom border
        }
        for (let y = 0; y < MAP_HEIGHT; y++) {
            this.addCollisionRect(-1, y);  // Left border
            this.addCollisionRect(MAP_WIDTH, y); // Right border
        }
    }

    addCollisionRect(tileX, tileY) {
        const rect = this.add.rectangle(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            tileY * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,  // Full tile width
            TILE_SIZE   // Full tile height
        );
        rect.setVisible(false);
        this.collisionGroup.add(rect);
    }

    spawnDecorations() {
        // New props layout: 5 cols x 3 rows
        // Row 0: tree trunk(0), tree canopy(1), small rock(2), large rock(3), bush(4)
        // Row 1: fence h(5), fence v(6), hay bale(7), crate(8), well(9)
        // Row 2: flowers(10), garden(11), sign(12), bench(13), lamp(14)

        const decorations = [
            // Flowers scattered around
            { x: 3, y: 5, frame: 10 },
            { x: 8, y: 8, frame: 10 },
            { x: 25, y: 7, frame: 10 },
            { x: 30, y: 18, frame: 10 },
            { x: 15, y: 22, frame: 10 },
            { x: 37, y: 12, frame: 10 },

            // Hay bales
            { x: 28, y: 5, frame: 7 },
            { x: 6, y: 18, frame: 7 },
            { x: 34, y: 22, frame: 7 },

            // Benches
            { x: 22, y: 14, frame: 13 },
            { x: 5, y: 25, frame: 13 },

            // Lamp posts
            { x: 18, y: 8, frame: 14 },
            { x: 22, y: 18, frame: 14 },

            // Signs
            { x: 10, y: 5, frame: 12 },
            { x: 30, y: 10, frame: 12 },

            // Garden plots
            { x: 25, y: 20, frame: 11 },
            { x: 26, y: 20, frame: 11 },
            { x: 27, y: 20, frame: 11 },
            { x: 25, y: 21, frame: 11 },
            { x: 26, y: 21, frame: 11 },
            { x: 27, y: 21, frame: 11 },
        ];

        for (const deco of decorations) {
            // Skip if tile is blocked
            if (this.blockedTiles.has(`${deco.x},${deco.y}`)) continue;

            const sprite = this.add.sprite(
                deco.x * TILE_SIZE + TILE_SIZE / 2,
                deco.y * TILE_SIZE + TILE_SIZE / 2,
                'new_props',
                deco.frame
            );
            sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
            sprite.setDepth(4); // Above ground, below player
        }

        // Add AIQNEX logos at strategic locations
        const logoPositions = [
            { x: 5, y: 3 },
            { x: 35, y: 5 },
            { x: 20, y: 25 },
            { x: 8, y: 20 },
            { x: 32, y: 18 }
        ];

        for (const pos of logoPositions) {
            if (!this.blockedTiles.has(`${pos.x},${pos.y}`)) {
                const logo = this.add.image(
                    pos.x * TILE_SIZE + TILE_SIZE / 2,
                    pos.y * TILE_SIZE + TILE_SIZE / 2,
                    'aiqnex_logo'
                );
                logo.setDisplaySize(TILE_SIZE * 1.5, TILE_SIZE * 1.5);
                logo.setAlpha(0.7);
                logo.setDepth(3);

                // Subtle glow animation
                this.tweens.add({
                    targets: logo,
                    alpha: 0.4,
                    scale: logo.scale * 1.1,
                    duration: 2000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        }
    }

    spawnVegetables() {
        this.vegetables = this.physics.add.group();
        const vegTypes = Object.keys(VEGETABLES);
        const levelConfig = this.getLevelConfig();
        const spawnCount = levelConfig.vegetables;
        let spawned = 0;
        let attempts = 0;

        while (spawned < spawnCount && attempts < 500) {
            attempts++;
            const x = Phaser.Math.Between(2, MAP_WIDTH - 3);
            const y = Phaser.Math.Between(2, MAP_HEIGHT - 3);

            const groundTileId = this.mapData.layers.ground[y][x];
            const isGrass = groundTileId >= 0 && groundTileId <= 2;
            const isBlocked = this.blockedTiles.has(`${x},${y}`);

            const spawn = this.mapData.playerSpawn;
            const distToSpawn = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);

            if (isGrass && !isBlocked && distToSpawn > 3) {
                const vegType = vegTypes[Phaser.Math.Between(0, vegTypes.length - 1)];
                this.createVegetable(x, y, vegType);
                spawned++;
            }
        }

        this.totalVegetables = spawned;
    }

    createVegetable(tileX, tileY, type) {
        const veg = this.physics.add.sprite(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            tileY * TILE_SIZE + TILE_SIZE / 2,
            `veg_${type}`
        );

        veg.setDepth(3);
        veg.vegetableType = type;

        this.tweens.add({
            targets: veg,
            y: veg.y - 3,
            duration: 1000 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.time.addEvent({
            delay: 2000 + Math.random() * 3000,
            callback: () => {
                if (veg.active) {
                    this.createSparkle(veg.x, veg.y);
                }
            },
            loop: true
        });

        this.vegetables.add(veg);
    }

    spawnInsects() {
        this.insects = this.physics.add.group();
        const insectTypes = Object.keys(INSECTS);
        const levelConfig = this.getLevelConfig();
        const spawnCount = levelConfig.insects;

        for (let i = 0; i < spawnCount; i++) {
            let x, y, attempts = 0;
            do {
                x = Phaser.Math.Between(3, MAP_WIDTH - 4);
                y = Phaser.Math.Between(3, MAP_HEIGHT - 4);
                attempts++;
            } while (this.blockedTiles.has(`${x},${y}`) && attempts < 50);

            const insectType = insectTypes[Phaser.Math.Between(0, insectTypes.length - 1)];
            this.createInsect(x, y, insectType);
        }
    }

    createInsect(tileX, tileY, type) {
        const insect = this.physics.add.sprite(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            tileY * TILE_SIZE + TILE_SIZE / 2,
            `insect_${type}`
        );

        insect.setDepth(8);
        insect.insectType = type;
        insect.setCollideWorldBounds(true);
        insect.body.setBounce(1);

        // Set proper body size for collision
        insect.body.setSize(20, 20);
        insect.body.setOffset(2, 2);

        // Random initial direction with level speed multiplier
        const angle = Math.random() * Math.PI * 2;
        const levelConfig = this.getLevelConfig();
        const speed = INSECTS[type].speed * levelConfig.insectSpeedMult;
        insect.insectSpeed = speed; // Store for direction changes
        insect.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        // Change direction randomly
        this.time.addEvent({
            delay: 2000 + Math.random() * 2000,
            callback: () => {
                if (insect.active) {
                    const newAngle = Math.random() * Math.PI * 2;
                    insect.body.setVelocity(
                        Math.cos(newAngle) * insect.insectSpeed,
                        Math.sin(newAngle) * insect.insectSpeed
                    );
                }
            },
            loop: true
        });

        // Collision with obstacles
        this.physics.add.collider(insect, this.collisionGroup, () => {
            const newAngle = Math.random() * Math.PI * 2;
            insect.body.setVelocity(
                Math.cos(newAngle) * speed,
                Math.sin(newAngle) * speed
            );
        });

        this.insects.add(insect);
    }

    createSparkle(x, y) {
        const sparkle = this.add.sprite(
            x + Phaser.Math.Between(-10, 10),
            y + Phaser.Math.Between(-10, 10),
            'sparkle'
        );
        sparkle.setDepth(50);
        sparkle.setAlpha(0);

        this.tweens.add({
            targets: sparkle,
            alpha: 1,
            scale: 1.5,
            duration: 200,
            yoyo: true,
            onComplete: () => sparkle.destroy()
        });
    }

    createParticles() {
        this.collectEmitter = this.add.particles(0, 0, 'sparkle', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 10,
            emitting: false
        });
        this.collectEmitter.setDepth(200);

        this.poisonEmitter = this.add.particles(0, 0, 'poison', {
            speed: { min: 20, max: 50 },
            scale: { start: 0.8, end: 0 },
            lifespan: 800,
            quantity: 3,
            emitting: false
        });
        this.poisonEmitter.setDepth(200);
    }

    createPlayerAnimations() {
        // Down (row 0)
        this.anims.create({ key: 'idle_down', frames: [{ key: 'player', frame: 0 }], frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'walk_down', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        // Up (row 1)
        this.anims.create({ key: 'idle_up', frames: [{ key: 'player', frame: 4 }], frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'walk_up', frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }), frameRate: 8, repeat: -1 });
        // Left (row 2)
        this.anims.create({ key: 'idle_left', frames: [{ key: 'player', frame: 8 }], frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'walk_left', frames: this.anims.generateFrameNumbers('player', { start: 8, end: 11 }), frameRate: 8, repeat: -1 });
        // Right (row 3)
        this.anims.create({ key: 'idle_right', frames: [{ key: 'player', frame: 12 }], frameRate: 1, repeat: -1 });
        this.anims.create({ key: 'walk_right', frames: this.anims.generateFrameNumbers('player', { start: 12, end: 15 }), frameRate: 8, repeat: -1 });
    }

    createPlayer() {
        const spawn = this.mapData.playerSpawn;

        this.player = this.physics.add.sprite(
            spawn.x * TILE_SIZE + TILE_SIZE / 2,
            spawn.y * TILE_SIZE + TILE_SIZE / 2,
            'player', 0
        );

        const scale = TILE_SIZE / SPRITE_FRAME_H * 1.5;
        this.player.setScale(scale);
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(SPRITE_FRAME_W * 0.4, SPRITE_FRAME_H * 0.3);
        this.player.body.setOffset(SPRITE_FRAME_W * 0.3, SPRITE_FRAME_H * 0.65);

        this.physics.add.collider(this.player, this.collisionGroup);
        this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

        // Vegetable overlap
        this.physics.add.overlap(this.player, this.vegetables, this.onVegetableNear, null, this);

        // Insect overlap (damage)
        this.physics.add.overlap(this.player, this.insects, this.onInsectHit, null, this);

        this.player.play('idle_down');
        this.player.lastDirection = 'down';
        this.nearbyVegetable = null;
    }

    onVegetableNear(player, vegetable) {
        this.nearbyVegetable = vegetable;
    }

    onInsectHit(player, insect) {
        if (this.isGameOver) return;
        if (this.player.isInvulnerable) return;

        // Get infected!
        const damage = INSECTS[insect.insectType].damage;
        this.infect(insect);

        // Brief invulnerability
        this.player.isInvulnerable = true;
        this.time.delayedCall(1000, () => {
            this.player.isInvulnerable = false;
        });

        // Push player back
        const angle = Phaser.Math.Angle.Between(insect.x, insect.y, player.x, player.y);
        player.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
    }

    infect(insect) {
        const damage = INSECTS[insect.insectType].damage;

        // Deal immediate damage
        this.takeDamage(damage * 0.1); // 10-20% health per hit
        this.showFloatingText(this.player.x, this.player.y - 30, `-${Math.round(damage * 10)}%`, 0xff0000);

        if (!this.isInfected) {
            this.isInfected = true;
            this.infectionTimer = INFECTION_DURATION;
            soundManager.playHurt();

            // Visual feedback
            this.player.setTint(0x88ff88);
            this.showFloatingText(this.player.x, this.player.y - 20, '☠️ INFECTED!', 0x00ff00);

            // Poison particles from insect
            this.poisonEmitter.setPosition(insect.x, insect.y);
            this.poisonEmitter.explode(5);
        } else {
            soundManager.playHurt();
        }

        this.updateUI();
    }

    takeDamage(amount) {
        this.health -= amount;

        if (this.health <= 0) {
            this.health = 1;
            this.lives--;
            soundManager.playHurt();

            // Flash player
            this.tweens.add({
                targets: this.player,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 3
            });

            if (this.lives <= 0) {
                this.gameOver();
            }
        }

        this.updateUI();
    }

    heal(amount) {
        if (this.lives < MAX_LIVES) {
            this.health += amount;
            if (this.health >= 1) {
                this.health = 1;
                // Could restore a life if we want to be generous
            }
        }
        soundManager.playHeal();
        this.showFloatingText(this.player.x, this.player.y - 30, '+HEAL', 0x00ff00);

        // Clear infection
        if (this.isInfected && amount >= 1) {
            this.isInfected = false;
            this.infectionTimer = 0;
            this.player.clearTint();
            this.infectionOverlay.setAlpha(0);
            this.showFloatingText(this.player.x, this.player.y - 45, 'CURED!', 0x00ffff);
        }
    }

    collectVegetable() {
        if (!this.nearbyVegetable || !this.nearbyVegetable.active) return;

        const veg = this.nearbyVegetable;
        const vegConfig = VEGETABLES[veg.vegetableType];

        soundManager.playCollect();

        this.score += vegConfig.points;
        this.collectedVegetables[veg.vegetableType]++;

        // Heal if vegetable has healing property
        if (vegConfig.heals > 0) {
            this.heal(vegConfig.heals);
        }

        this.collectEmitter.setPosition(veg.x, veg.y);
        this.collectEmitter.explode(10);

        this.showFloatingText(veg.x, veg.y, `+${vegConfig.points}`, vegConfig.color);

        // Show Quantum/AI concept popup
        this.showConceptPopup(vegConfig);

        this.tweens.add({
            targets: veg,
            y: veg.y - 30,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => {
                veg.destroy();
                this.updateUI();
                this.checkWinCondition();
            }
        });

        this.nearbyVegetable = null;
    }

    showConceptPopup(vegConfig) {
        // Show concept in the HTML concept panel
        const conceptEl = document.getElementById('concept-title');
        const descEl = document.getElementById('concept-desc');
        const panelEl = document.getElementById('concept-panel');

        if (conceptEl && descEl && panelEl) {
            conceptEl.textContent = `🔮 ${vegConfig.concept}`;
            descEl.textContent = vegConfig.description;
            panelEl.classList.add('visible');

            // Hide after 3 seconds
            setTimeout(() => {
                panelEl.classList.remove('visible');
            }, 3000);
        }

        // Special AIQNEX popup for special veggies
        if (vegConfig.special) {
            this.showAiqnexPopup();
        }
    }

    showAiqnexPopup() {
        // Create fullscreen popup with logo
        const overlay = this.add.rectangle(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2,
            MAP_WIDTH * TILE_SIZE,
            MAP_HEIGHT * TILE_SIZE,
            0x000000, 0.85
        ).setDepth(2000);

        const logo = this.add.image(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2 - 30,
            'aiqnex_logo'
        ).setDepth(2001).setScale(0.3);

        const text = this.add.text(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE / 2 + 60,
            '⚡ AIQNEX CRYSTAL COLLECTED! ⚡\nQuantum Advantage Unlocked!',
            { font: 'bold 12px Arial', fill: '#ffd700', align: 'center' }
        ).setOrigin(0.5).setDepth(2001);

        // Animate in
        logo.setScale(0);
        overlay.setAlpha(0);

        this.tweens.add({
            targets: overlay,
            alpha: 0.85,
            duration: 300
        });

        this.tweens.add({
            targets: logo,
            scale: 0.25,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Fade out after 2 seconds
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: [overlay, logo, text],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    logo.destroy();
                    text.destroy();
                }
            });
        });
    }

    showFloatingText(x, y, text, color) {
        const floatText = this.add.text(x, y, text, {
            font: 'bold 14px Arial',
            fill: '#' + color.toString(16).padStart(6, '0'),
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: floatText,
            y: y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => floatText.destroy()
        });
    }

    checkWinCondition() {
        const collected = Object.values(this.collectedVegetables).reduce((a, b) => a + b, 0);
        if (collected >= this.totalVegetables) {
            soundManager.playWin();
            this.showWinScreen();
        }
    }

    gameOver() {
        this.isGameOver = true;
        soundManager.playGameOver();

        // Stop player
        this.player.body.setVelocity(0);

        // Darken screen
        const overlay = this.add.rectangle(320, 240, 640, 480, 0x000000, 0.8)
            .setDepth(500).setScrollFactor(0);

        this.add.text(320, 180, '💀 GAME OVER 💀', {
            font: 'bold 36px Arial',
            fill: '#ff4444'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        this.add.text(320, 240, `Final Score: ${this.score}`, {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        const restartText = this.add.text(320, 320, 'Press R to Restart', {
            font: '20px Arial',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        this.tweens.add({
            targets: restartText,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        this.input.keyboard.once('keydown-R', () => {
            this.currentLevel = 1;
            this.scene.restart({ level: 1, score: 0 });
        });
    }

    showWinScreen() {
        this.isGameOver = true;
        soundManager.playWin();

        const isLastLevel = this.currentLevel >= 3;
        const levelConfig = this.getLevelConfig();

        const overlay = this.add.rectangle(320, 240, 640, 480, 0x000000, 0.85)
            .setDepth(500).setScrollFactor(0);

        if (isLastLevel) {
            // Final victory!
            this.add.text(320, 120, '🏆 GAME COMPLETE! 🏆', {
                font: 'bold 32px Arial',
                fill: '#ffd700'
            }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

            this.add.text(320, 170, 'You conquered all 3 levels!', {
                font: '18px Arial',
                fill: '#88ff88'
            }).setOrigin(0.5).setDepth(501).setScrollFactor(0);
        } else {
            this.add.text(320, 120, `🎉 Level ${this.currentLevel} Complete! 🎉`, {
                font: 'bold 28px Arial',
                fill: '#ffd700'
            }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

            const nextConfig = {
                1: { name: 'Busy Farm', vegetables: 20, insects: 8 },
                2: { name: 'Danger Zone', vegetables: 30, insects: 15 }
            }[this.currentLevel] || {};

            this.add.text(320, 165, `Next: Level ${this.currentLevel + 1} - ${nextConfig.name}`, {
                font: '16px Arial',
                fill: '#88ff88'
            }).setOrigin(0.5).setDepth(501).setScrollFactor(0);
        }

        this.add.text(320, 210, `Score: ${this.score}`, {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        this.add.text(320, 250, `Lives Remaining: ${this.lives} ❤️`, {
            font: '18px Arial',
            fill: '#ff6666'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        let yPos = 290;
        Object.entries(this.collectedVegetables).forEach(([type, count]) => {
            if (count > 0) {
                this.add.text(320, yPos, `${VEGETABLES[type].name}: ${count}`, {
                    font: '14px Arial',
                    fill: '#ffffff'
                }).setOrigin(0.5).setDepth(501).setScrollFactor(0);
                yPos += 20;
            }
        });

        const promptY = isLastLevel ? 400 : 380;
        const promptText = isLastLevel ?
            'Press R to Play Again from Level 1' :
            `Press SPACE for Level ${this.currentLevel + 1}  |  R to Restart`;

        const restartText = this.add.text(320, promptY, promptText, {
            font: '18px Arial',
            fill: '#aaaaaa'
        }).setOrigin(0.5).setDepth(501).setScrollFactor(0);

        this.tweens.add({
            targets: restartText,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // Restart from level 1
        this.input.keyboard.once('keydown-R', () => {
            this.currentLevel = 1;
            this.scene.restart({ level: 1, score: 0 });
        });

        // Continue to next level (if not last)
        if (!isLastLevel) {
            this.input.keyboard.once('keydown-SPACE', () => {
                this.scene.restart({
                    level: this.currentLevel + 1,
                    score: this.score
                });
            });
        }
    }

    setupCamera() {
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(2);
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Mobile Touch Controls
        const addTouchListener = (id, key) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const setPressed = (pressed) => {
                this.touchInput[key] = pressed;
                if (pressed) btn.classList.add('active');
                else btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', (e) => { e.preventDefault(); setPressed(true); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); setPressed(false); });
            btn.addEventListener('mousedown', (e) => { setPressed(true); });
            btn.addEventListener('mouseup', (e) => { setPressed(false); });
            btn.addEventListener('mouseleave', (e) => { setPressed(false); });
        };

        addTouchListener('btn-up', 'up');
        addTouchListener('btn-down', 'down');
        addTouchListener('btn-left', 'left');
        addTouchListener('btn-right', 'right');

        // Action buttons
        const collectBtn = document.getElementById('btn-collect');
        if (collectBtn) {
            collectBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.collectVegetable();
                collectBtn.classList.add('active');
            });
            collectBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                collectBtn.classList.remove('active');
            });
            collectBtn.addEventListener('mousedown', () => {
                this.collectVegetable();
                collectBtn.classList.add('active');
            });
            collectBtn.addEventListener('mouseup', () => collectBtn.classList.remove('active'));
        }

        const restartBtn = document.getElementById('btn-restart');
        if (restartBtn) {
            const restartAction = (e) => {
                e.preventDefault();
                if (this.isGameOver) {
                    this.currentLevel = 1;
                    this.scene.restart({ level: 1, score: 0 });
                } else {
                    // Maybe confirm restart? For now just restart level
                    this.scene.restart({ level: this.currentLevel, score: this.score });
                }
            };
            restartBtn.addEventListener('touchstart', restartAction);
            restartBtn.addEventListener('click', restartAction);
        }


        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E).on('down', () => this.collectVegetable());
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.collectVegetable());
    }

    createUI() {
        // UI is now HTML-based (see index.html #hud-overlay)
        // Only create in-game prompt text for collection hints
        this.promptText = this.add.text(
            MAP_WIDTH * TILE_SIZE / 2,
            MAP_HEIGHT * TILE_SIZE - 40,
            '', {
            font: 'bold 14px Arial',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }
        ).setOrigin(0.5).setDepth(1001);

        this.updateUI();
    }

    updateUI() {
        // Update HTML HUD elements
        const livesEl = document.getElementById('hud-lives');
        const healthBarEl = document.getElementById('hud-health-bar');
        const healthTextEl = document.getElementById('hud-health-text');
        const statusEl = document.getElementById('hud-status');
        const scoreEl = document.getElementById('hud-score');
        const veggiesEl = document.getElementById('hud-veggies');

        if (!livesEl) return; // HUD not ready yet

        // Update lives hearts
        let heartsStr = '';
        for (let i = 0; i < MAX_LIVES; i++) {
            heartsStr += i < this.lives ? '❤️' : '🖤';
        }
        livesEl.textContent = heartsStr;

        // Update health bar
        const healthPercent = Math.max(0, Math.round(this.health * 100));
        healthBarEl.style.width = healthPercent + '%';
        healthTextEl.textContent = healthPercent + '%';

        // Health bar color
        healthBarEl.classList.remove('low', 'medium', 'infected');
        if (this.isInfected) {
            healthBarEl.classList.add('infected');
        } else if (this.health < 0.3) {
            healthBarEl.classList.add('low');
        } else if (this.health < 0.6) {
            healthBarEl.classList.add('medium');
        }

        // Update status
        if (this.isInfected) {
            const timeLeft = Math.ceil(this.infectionTimer / 1000);
            statusEl.textContent = `☠️ INFECTED! (${timeLeft}s)`;
            statusEl.className = 'hud-value status infected';
        } else {
            statusEl.textContent = '✓ Healthy';
            statusEl.className = 'hud-value status healthy';
        }

        // Update score and veggies
        const collected = Object.values(this.collectedVegetables).reduce((a, b) => a + b, 0);
        scoreEl.textContent = this.score;
        veggiesEl.textContent = `🥕 ${collected}/${this.totalVegetables}`;
    }

    update(time, delta) {
        if (!this.player || this.isGameOver) return;

        const body = this.player.body;
        body.setVelocity(0);

        let moving = false;
        let direction = this.player.lastDirection;

        if (this.cursors.left.isDown || this.wasd.left.isDown || this.touchInput.left) {
            body.setVelocityX(-PLAYER_SPEED);
            direction = 'left';
            moving = true;
        } else if (this.cursors.right.isDown || this.wasd.right.isDown || this.touchInput.right) {
            body.setVelocityX(PLAYER_SPEED);
            direction = 'right';
            moving = true;
        }

        if (this.cursors.up.isDown || this.wasd.up.isDown || this.touchInput.up) {
            body.setVelocityY(-PLAYER_SPEED);
            direction = 'up';
            moving = true;
        } else if (this.cursors.down.isDown || this.wasd.down.isDown || this.touchInput.down) {
            body.setVelocityY(PLAYER_SPEED);
            direction = 'down';
            moving = true;
        }

        if (body.velocity.x !== 0 && body.velocity.y !== 0) {
            body.velocity.normalize().scale(PLAYER_SPEED);
        }

        if (moving) {
            this.player.play(`walk_${direction}`, true);
            this.footstepTimer += delta;
            if (this.footstepTimer > 250) {
                soundManager.playFootstep();
                this.footstepTimer = 0;
            }
        } else {
            this.player.play(`idle_${direction}`, true);
            this.footstepTimer = 0;
        }

        this.player.lastDirection = direction;
        this.player.setDepth(10 + this.player.y * 0.001);

        // Infection damage over time
        if (this.isInfected) {
            this.infectionTimer -= delta;
            this.takeDamage(INFECTION_DAMAGE_RATE * delta / 1000);

            // Poison particles occasionally
            if (Math.random() < 0.05) {
                this.poisonEmitter.setPosition(this.player.x, this.player.y);
                this.poisonEmitter.explode(1);
            }

            // Visual pulse
            const pulse = 0.1 + Math.sin(time / 200) * 0.05;
            this.infectionOverlay.setAlpha(pulse);

            // Infection wears off
            if (this.infectionTimer <= 0) {
                this.isInfected = false;
                this.player.clearTint();
                this.infectionOverlay.setAlpha(0);
                this.showFloatingText(this.player.x, this.player.y - 20, 'Infection cleared', 0x00ffff);
            }

            this.updateUI();
        }

        // Insect proximity check and buzz sounds
        this.buzzTimer += delta;
        if (this.buzzTimer > 100) {
            this.insects.children.iterate((insect) => {
                if (insect && insect.active) {
                    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, insect.x, insect.y);

                    // Manual collision check - if within 20 pixels, trigger hit
                    if (dist < 25 && !this.player.isInvulnerable && !this.isGameOver) {
                        this.onInsectHit(this.player, insect);
                    }

                    // Buzz sound if nearby
                    if (dist < 100 && this.buzzTimer > 400) {
                        soundManager.playBuzz();
                    }
                }
            });
            if (this.buzzTimer > 500) this.buzzTimer = 0;
        }

        // Update prompt
        if (this.nearbyVegetable && this.nearbyVegetable.active) {
            const vegConfig = VEGETABLES[this.nearbyVegetable.vegetableType];
            let prompt = `Press E: ${vegConfig.name}`;
            if (vegConfig.heals > 0) prompt += ' (Heals!)';
            this.promptText.setText(prompt);
            this.promptText.setVisible(true);
        } else {
            this.promptText.setVisible(false);
            this.nearbyVegetable = null;
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 480,
    parent: 'game-container',
    pixelArt: true,
    backgroundColor: '#1a472a',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, GameScene]
};

const game = new Phaser.Game(config);
