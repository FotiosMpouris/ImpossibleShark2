console.log("Cosmic Collector Enhanced game.js starting...");

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreElement = document.getElementById('final-score');

    if (!canvas || !startScreen || !gameOverScreen || !finalScoreElement) {
        console.error("HTML elements (canvas or overlays) not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    // --- Constants ---
    const PLAYER_WIDTH = 45;
    const PLAYER_HEIGHT = 25;
    const PLAYER_BASE_Y = canvas.height - PLAYER_HEIGHT - 15;
    const PLAYER_SPEED = 8;
    const PLAYER_COLOR_BODY = '#00FF00'; // Green
    const PLAYER_COLOR_WINDOW = '#ADD8E6'; // Light Blue
    const PLAYER_COLOR_FLAME1 = '#FFA500'; // Orange
    const PLAYER_COLOR_FLAME2 = '#FF0000'; // Red
    const MAX_LIVES = 3;
    const INVINCIBILITY_DURATION = 120; // Frames (approx 2 seconds at 60fps)

    const ITEM_SIZE_BASE = 18; // Base size for items
    const STAR_COLOR = '#FFFF00'; // Yellow
    const ASTEROID_COLOR_MAIN = '#A0522D'; // Brown/Sienna
    const ASTEROID_COLOR_DETAIL = '#693d1a'; // Darker brown
    const POWERUP_SHIELD_COLOR = '#00BFFF'; // Deep Sky Blue
    const POWERUP_MULTI_COLOR = '#FF4500'; // Orange Red

    const STARFIELD_LAYERS = 3;
    const STARS_PER_LAYER = [50, 70, 100]; // Fewer far away, more close up
    const STARFIELD_SPEEDS = [0.1, 0.25, 0.5]; // Parallax speeds

    const INITIAL_SPAWN_RATE = 0.018; // Slightly higher start
    const MAX_SPAWN_RATE = 0.06;
    const SPAWN_RATE_INCREASE = 0.000015; // Slightly faster increase
    const INITIAL_ITEM_SPEED = 2.5;
    const MAX_ITEM_SPEED = 9;
    const ITEM_SPEED_INCREASE = 0.0007;
    const POWERUP_SPAWN_CHANCE = 0.005; // Chance *per frame* a powerup might spawn instead of normal item

    const PARTICLE_COUNT = 20;
    const PARTICLE_LIFESPAN = 40; // Frames
    const PARTICLE_SPEED = 3;
    const SHAKE_DURATION = 15; // Frames
    const SHAKE_MAGNITUDE = 4; // Pixels
    const MULTIPLIER_DURATION = 400; // Frames

    // --- Game State Variables ---
    let score = 0;
    let lives = MAX_LIVES;
    let gameOver = false;
    let isGameStarted = false; // Controls showing the start screen
    let starLayers = []; // For background starfield (array of arrays)
    let spawnRate = INITIAL_SPAWN_RATE;
    let itemSpeed = INITIAL_ITEM_SPEED;
    let particles = [];
    let screenShake = { duration: 0, magnitude: 0 };
    let playerInvincible = false;
    let invincibilityTimer = 0;
    let scoreMultiplier = 1;
    let multiplierTimer = 0;

    const player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: PLAYER_BASE_Y,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        dx: 0 // Change in x per frame
    };

    let items = []; // Array to hold falling stars, asteroids, and powerups

    // Input handling
    const keys = {
        ArrowLeft: false,
        ArrowRight: false
    };

    // --- Audio Placeholder ---
    const sounds = {}; // Store audio elements
    function loadAudio(key, src) {
        // This is a placeholder - uncomment and provide real paths if using audio
        console.warn(`Audio loading disabled. Would load: ${key} from ${src}`);
        // try {
        //     const audio = new Audio(src);
        //     audio.load(); // Start loading
        //     sounds[key] = audio;
        //     console.log(`Attempting to load audio: ${key}`);
        // } catch (e) {
        //     console.error(`Error loading audio ${key}:`, e);
        // }
    }
    function playSound(key, volume = 0.7) {
        console.warn(`Audio playing disabled. Would play: ${key}`);
        // if (sounds[key]) {
        //     try {
        //         sounds[key].currentTime = 0; // Rewind
        //         sounds[key].volume = Math.max(0, Math.min(1, volume));
        //         sounds[key].play().catch(e => console.warn(`Playback failed for ${key}: ${e.message}`));
        //     } catch (e) {
        //         console.error(`Error playing sound ${key}:`, e);
        //     }
        // }
    }
     // --- Load Audio Assets (Optional) ---
     // loadAudio('music', 'assets/music.mp3'); // Add your background music
     // loadAudio('collect', 'assets/collect.wav');
     // loadAudio('hit', 'assets/hit.wav');
     // loadAudio('powerup', 'assets/powerup.wav');
     // loadAudio('gameOver', 'assets/gameOver.wav');


    // --- Utility Functions ---
    function checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    function triggerScreenShake(duration, magnitude) {
        screenShake.duration = Math.max(screenShake.duration, duration);
        screenShake.magnitude = Math.max(screenShake.magnitude, magnitude);
    }

    function createStarfield() {
        starLayers = [];
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            let stars = [];
            for (let i = 0; i < STARS_PER_LAYER[layer]; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * (1.5 - layer * 0.4) + 0.5 // Farther stars are smaller
                });
            }
            starLayers.push(stars);
        }
        console.log("Parallax starfield created.");
    }

    function spawnParticle(x, y, color) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * PARTICLE_SPEED + 1;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            lifespan: PARTICLE_LIFESPAN + Math.random() * 10,
            color: color,
            radius: Math.random() * 3 + 1
        });
    }

    function spawnExplosion(x, y) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            spawnParticle(x, y, ASTEROID_COLOR_DETAIL);
            if (Math.random() < 0.3) spawnParticle(x, y, PLAYER_COLOR_FLAME1); // Mix in some flame colors
        }
    }


    // --- Game Logic Functions ---

    function spawnItem() {
        // Decide whether to spawn anything
        if (Math.random() < spawnRate) {
            const x = Math.random() * (canvas.width - ITEM_SIZE_BASE);
            const y = -ITEM_SIZE_BASE; // Start just above the screen
            let type = 'star'; // Default
            let color = STAR_COLOR;
            let size = ITEM_SIZE_BASE;
            let powerUpType = null;

            // Check for powerup spawn override
            if (Math.random() < POWERUP_SPAWN_CHANCE) {
                 type = 'powerup';
                 size = ITEM_SIZE_BASE * 1.2; // Make powerups slightly bigger
                 if (Math.random() < 0.5) {
                     powerUpType = 'shield';
                     color = POWERUP_SHIELD_COLOR;
                 } else {
                     powerUpType = 'multiplier';
                     color = POWERUP_MULTI_COLOR;
                 }
                 console.log("Spawning Powerup:", powerUpType);
            }
            // If not a powerup, decide between star and asteroid
            else if (Math.random() > 0.65) { // 65% chance of star (adjust balance)
                 type = 'asteroid';
                 color = ASTEROID_COLOR_MAIN; // Not really used for drawing asteroid, but good for consistency
                 size = ITEM_SIZE_BASE * (Math.random() * 0.4 + 0.8); // Asteroids vary in size
            }

            items.push({
                x: x,
                y: y,
                size: size,
                speed: itemSpeed + (Math.random() * 1.5 - 0.75), // Add speed variation
                type: type,
                color: color, // Used for stars and powerups
                powerUpType: powerUpType,
                // Asteroid specific
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.1, // Radians per frame
                // Star specific
                pulseValue: Math.random(), // For size/alpha pulsing
                pulseDirection: 1
            });
        }
    }

    function updatePlayer() {
        // --- Invincibility Timer ---
        if (playerInvincible) {
            invincibilityTimer--;
            if (invincibilityTimer <= 0) {
                playerInvincible = false;
            }
        }

        // --- Movement ---
        player.dx = 0;
        if (keys.ArrowLeft) player.dx = -PLAYER_SPEED;
        if (keys.ArrowRight) player.dx = PLAYER_SPEED;

        player.x += player.dx;

        // Keep player within bounds
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    }

    function updateItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.y += item.speed;

            // Update item-specific properties
            if (item.type === 'asteroid') {
                item.rotation += item.rotationSpeed;
            } else if (item.type === 'star') {
                item.pulseValue += 0.05 * item.pulseDirection;
                if (item.pulseValue > 1 || item.pulseValue < 0.5) {
                    item.pulseDirection *= -1; // Reverse pulse direction
                }
            }

            // --- Collision Check ---
            const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
            // Use a slightly smaller hitbox for items than their visual size for forgiveness
            const itemHitboxSize = item.size * 0.8;
            const itemRect = {
                x: item.x + (item.size - itemHitboxSize) / 2,
                y: item.y + (item.size - itemHitboxSize) / 2,
                width: itemHitboxSize,
                height: itemHitboxSize
            };

            if (checkCollision(playerRect, itemRect)) {
                if (item.type === 'star') {
                    score += scoreMultiplier;
                    playSound('collect', 0.5);
                    items.splice(i, 1);
                    // Maybe add floating score text here
                }
                else if (item.type === 'powerup') {
                    playSound('powerup', 0.8);
                    if (item.powerUpType === 'shield') {
                        playerInvincible = true;
                        invincibilityTimer = INVINCIBILITY_DURATION * 1.5; // Shield lasts longer
                        console.log("Shield Activated!");
                    } else if (item.powerUpType === 'multiplier') {
                        scoreMultiplier = 2;
                        multiplierTimer = MULTIPLIER_DURATION;
                        console.log("x2 Score Activated!");
                    }
                    items.splice(i, 1);
                }
                else if (item.type === 'asteroid' && !playerInvincible) { // Hit an asteroid!
                    playSound('hit', 1.0);
                    lives--;
                    spawnExplosion(item.x + item.size / 2, item.y + item.size / 2); // Explosion at item center
                    triggerScreenShake(SHAKE_DURATION, SHAKE_MAGNITUDE);
                    items.splice(i, 1); // Remove asteroid

                    if (lives <= 0) {
                        gameOver = true;
                        playSound('gameOver');
                         // Display game over screen via CSS
                         gameOverScreen.classList.add('visible');
                         finalScoreElement.textContent = `Final Score: ${score}`;
                        console.log("Game Over! Final Score:", score);
                        return; // Stop processing items this frame
                    } else {
                        // Still alive, grant temporary invincibility
                        playerInvincible = true;
                        invincibilityTimer = INVINCIBILITY_DURATION;
                    }
                }
                 // else if asteroid and invincible, do nothing!
            }
            // Remove items that fall off the bottom
            else if (item.y > canvas.height) {
                items.splice(i, 1);
            }
        }
    }

    function updatePowerUps() {
        if (multiplierTimer > 0) {
            multiplierTimer--;
            if (multiplierTimer <= 0) {
                scoreMultiplier = 1; // Reset multiplier
                console.log("x2 Score Ended.");
            }
        }
        // Shield timer is handled in updatePlayer (as invincibilityTimer)
    }

     function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.lifespan--;
            // Apply some gravity or friction? Optional.
            // p.vy += 0.1;
            // p.vx *= 0.99;
            // p.vy *= 0.99;

            if (p.lifespan <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function updateDifficulty() {
        spawnRate = Math.min(MAX_SPAWN_RATE, spawnRate + SPAWN_RATE_INCREASE);
        itemSpeed = Math.min(MAX_ITEM_SPEED, itemSpeed + ITEM_SPEED_INCREASE);
    }

    function updateStarfield() {
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            starLayers[layer].forEach(star => {
                star.y += STARFIELD_SPEEDS[layer] * (itemSpeed / INITIAL_ITEM_SPEED); // Move stars based on game speed
                if (star.y > canvas.height) {
                    star.y = 0; // Reset to top
                    star.x = Math.random() * canvas.width; // Randomize x position
                }
            });
        }
    }


    // --- Drawing Functions ---

    function drawStarfield() {
        ctx.fillStyle = '#FFFFFF';
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            // Fainter stars for farther layers
            ctx.globalAlpha = 0.4 + (layer / STARFIELD_LAYERS) * 0.6;
            starLayers[layer].forEach(star => {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        ctx.globalAlpha = 1.0; // Reset alpha
    }

    function drawPlayer() {
        // Flash player if invincible
        if (playerInvincible && Math.floor(invincibilityTimer / 6) % 2 === 0) {
            return; // Skip drawing every few frames to create flash
        }

        // Draw main body
        ctx.fillStyle = PLAYER_COLOR_BODY;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y); // Top point
        ctx.lineTo(player.x, player.y + player.height * 0.8); // Mid left wing base
        ctx.lineTo(player.x + player.width * 0.2, player.y + player.height); // Bottom left point
        ctx.lineTo(player.x + player.width * 0.8, player.y + player.height); // Bottom right point
        ctx.lineTo(player.x + player.width, player.y + player.height * 0.8); // Mid right wing base
        ctx.closePath();
        ctx.fill();

        // Draw 'window'
        ctx.fillStyle = PLAYER_COLOR_WINDOW;
        ctx.fillRect(player.x + player.width * 0.3, player.y + player.height * 0.2, player.width * 0.4, player.height * 0.3);

        // Draw flickering flame exhaust
        const flameHeight = player.height * (0.6 + Math.random() * 0.5); // Variable height
        const flameWidth = player.width * (0.3 + Math.random() * 0.2); // Variable width
        const flameOffsetX = (player.width - flameWidth) / 2;

        // Outer flame (Red)
        ctx.fillStyle = PLAYER_COLOR_FLAME2;
        ctx.beginPath();
        ctx.moveTo(player.x + flameOffsetX, player.y + player.height);
        ctx.lineTo(player.x + player.width - flameOffsetX, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameHeight);
        ctx.closePath();
        ctx.fill();

         // Inner flame (Orange)
        ctx.fillStyle = PLAYER_COLOR_FLAME1;
        ctx.beginPath();
        ctx.moveTo(player.x + flameOffsetX + 2, player.y + player.height);
        ctx.lineTo(player.x + player.width - flameOffsetX - 2, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameHeight * 0.6); // Shorter inner flame
        ctx.closePath();
        ctx.fill();
    }

    function drawItems() {
        items.forEach(item => {
            if (item.type === 'star') {
                // Pulsing effect using size and alpha
                const size = item.size * item.pulseValue;
                const alpha = 0.7 + (item.pulseValue - 0.5) * 0.6; // Brighter when bigger
                ctx.fillStyle = STAR_COLOR;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                // Simple 4-point star shape
                ctx.moveTo(item.x + size / 2, item.y); // Top
                ctx.lineTo(item.x + size * 0.65, item.y + size * 0.35); // Top right inset
                ctx.lineTo(item.x + size, item.y + size / 2); // Right
                ctx.lineTo(item.x + size * 0.65, item.y + size * 0.65); // Bottom right inset
                ctx.lineTo(item.x + size / 2, item.y + size); // Bottom
                ctx.lineTo(item.x + size * 0.35, item.y + size * 0.65); // Bottom left inset
                ctx.lineTo(item.x, item.y + size / 2); // Left
                ctx.lineTo(item.x + size * 0.35, item.y + size * 0.35); // Top left inset
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            else if (item.type === 'asteroid') {
                ctx.save(); // Save context for rotation
                ctx.translate(item.x + item.size / 2, item.y + item.size / 2); // Move origin to item center
                ctx.rotate(item.rotation); // Rotate
                // Draw asteroid main body
                ctx.fillStyle = ASTEROID_COLOR_MAIN;
                ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
                // Draw details (craters) - positions relative to center now
                ctx.fillStyle = ASTEROID_COLOR_DETAIL;
                ctx.fillRect(-item.size * 0.3, -item.size * 0.3, item.size * 0.3, item.size * 0.3);
                ctx.fillRect(item.size * 0.1, 0, item.size * 0.2, item.size * 0.2);
                ctx.restore(); // Restore context
            }
            else if (item.type === 'powerup') {
                 // Draw a simple representation (e.g., circle with initial)
                 ctx.fillStyle = item.color;
                 ctx.beginPath();
                 ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2);
                 ctx.fill();
                 // Draw initial 'S' or 'x2'
                 ctx.fillStyle = 'white';
                 ctx.font = `bold ${item.size * 0.6}px Arial`;
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 const text = (item.powerUpType === 'shield') ? 'S' : 'x2';
                 ctx.fillText(text, item.x + item.size / 2, item.y + item.size / 2 + 1); // +1 for better centering
                 ctx.textAlign = 'left'; // Reset
                 ctx.textBaseline = 'alphabetic'; // Reset
            }
        });
    }

    function drawParticles() {
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            // Fade out particles
            ctx.globalAlpha = Math.max(0, p.lifespan / PARTICLE_LIFESPAN);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0; // Reset alpha
    }

    function drawUI() {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Consolas, "Courier New", monospace';
        ctx.textAlign = 'left';

        // Draw Score
        ctx.fillText(`Score: ${score}`, 15, 35);

        // Draw Lives (using simple heart shapes or text)
        let livesDisplay = 'Lives: ';
        for (let i = 0; i < lives; i++) {
            livesDisplay += '\u2665 '; // Unicode heart symbol
        }
        ctx.fillStyle = '#FF6347'; // Tomato color for hearts
        ctx.fillText(livesDisplay, canvas.width - 150, 35);

        // Draw Multiplier Status
        if (multiplierTimer > 0) {
            ctx.fillStyle = POWERUP_MULTI_COLOR;
            ctx.font = 'bold 28px Consolas, "Courier New", monospace';
            ctx.fillText(`x2!`, canvas.width / 2 - 20, 35);
        }
         // Draw Shield Status
         if (playerInvincible && invincibilityTimer > 0) { // Use invincibility timer
             ctx.fillStyle = POWERUP_SHIELD_COLOR;
             ctx.font = 'bold 20px Consolas, "Courier New", monospace';
             // Optional: Show remaining shield time visually?
             // const shieldBarWidth = (invincibilityTimer / INVINCIBILITY_DURATION) * 100;
             // ctx.fillRect(canvas.width - 150, 50, shieldBarWidth, 10);
             ctx.fillText(`SHIELD`, canvas.width - 150, 60);

         }
    }

    // --- Game Loop ---
    function gameLoop() {
        if (!isGameStarted) {
             // Still on start screen - might draw a static background?
             ctx.fillStyle = '#000000';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             if (starLayers.length > 0) drawStarfield(); // Draw stars even on start screen
            // Input handled by window listener to start the game
            requestAnimationFrame(gameLoop); // Keep checking if game started
            return;
        }

        if (gameOver) {
            // Draw final frame state but don't update
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawStarfield();
            drawItems(); // Draw items frozen in place
            drawParticles(); // Let existing particles finish
            drawPlayer();
            // UI handled by overlay
            requestAnimationFrame(gameLoop); // Keep drawing final state
            return;
        }

        // --- Pre-drawing state reset & Screen Shake ---
        ctx.save();
        let shakeX = 0, shakeY = 0;
        if (screenShake.duration > 0) {
            shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            ctx.translate(shakeX, shakeY);
            screenShake.duration--;
            if (screenShake.duration <= 0) screenShake.magnitude = 0;
        }

        // --- Clear Canvas ---
        ctx.fillStyle = '#000000';
        ctx.fillRect(-shakeX, -shakeY, canvas.width + Math.abs(shakeX * 2), canvas.height + Math.abs(shakeY*2)); // Clear considering shake

        // --- Updates ---
        updateStarfield();
        updatePlayer();
        updatePowerUps();
        spawnItem();
        updateItems(); // This now handles collisions and potential game over
        updateParticles();
        updateDifficulty();

        // --- Drawing ---
        drawStarfield();
        drawParticles();
        drawItems();
        drawPlayer();
        drawUI();

        ctx.restore(); // Restore context before next frame

        requestAnimationFrame(gameLoop); // Request the next frame
    }

    // --- Initialization ---
    function initGame() {
        console.log("Initializing game state...");
        score = 0;
        lives = MAX_LIVES;
        gameOver = false;
        isGameStarted = true; // Mark game as started
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        player.dx = 0;
        items = [];
        particles = [];
        spawnRate = INITIAL_SPAWN_RATE;
        itemSpeed = INITIAL_ITEM_SPEED;
        playerInvincible = false;
        invincibilityTimer = 0;
        scoreMultiplier = 1;
        multiplierTimer = 0;
        screenShake = { duration: 0, magnitude: 0 };
        keys.ArrowLeft = false; // Reset keys
        keys.ArrowRight = false;


        // Ensure starfield is created
        if (starLayers.length === 0) {
            createStarfield();
        }

         // Hide overlays
         startScreen.classList.remove('visible');
         gameOverScreen.classList.remove('visible');

        // Add game input listeners ONLY when game starts
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
         // Optional: Start background music
         // playSound('music', 0.4);

        console.log("Starting main game loop...");
        requestAnimationFrame(gameLoop); // Start the main loop
    }

     // Input Handlers
     function handleKeyDown(e) {
         // Handle start/restart separately
         if (!isGameStarted && e.code === 'Enter') {
             initGame();
             return; // Don't process game movement keys yet
         }
         if (gameOver && e.code === 'Enter') {
             initGame(); // Restart
             return;
         }

         // Game controls (only if game is running and not over)
         if (isGameStarted && !gameOver) {
             if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
             if (e.code === 'ArrowRight') keys.ArrowRight = true;
         }
     }
     function handleKeyUp(e) {
         // Always track keyup to prevent sticky keys
         if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
         if (e.code === 'ArrowRight') keys.ArrowRight = false;
     }

    // --- Initial Setup ---
    // Create starfield immediately so it shows on start screen
    createStarfield();
    // Draw initial background and wait for start
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStarfield();

    // Add ONLY the listener needed to start the game initially
    window.addEventListener('keydown', handleKeyDown);

    console.log("Game setup complete. Waiting for user to start.");

}); // End DOMContentLoaded
