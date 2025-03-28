console.log("Cosmic Collector Refined game.js starting...");

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
    // *** New Movement Physics ***
    const PLAYER_ACCELERATION = 0.6; // How quickly the ship speeds up
    const PLAYER_FRICTION = 0.92;    // How quickly the ship slows down (lower = more friction)
    const PLAYER_MAX_VX = 7;         // Maximum horizontal speed
    // *** End New Movement Physics ***
    const PLAYER_COLOR_BODY = '#00FF00';
    const PLAYER_COLOR_WINDOW = '#ADD8E6';
    const PLAYER_COLOR_FLAME1 = '#FFA500';
    const PLAYER_COLOR_FLAME2 = '#FF0000';
    const MAX_LIVES = 3;
    const INVINCIBILITY_DURATION = 120;
    const COLLECT_HITBOX_LEEWAY = 5; // Extra pixels around player for collecting items

    const ITEM_SIZE_BASE = 18;
    const STAR_COLOR = '#FFFF00';
    const ASTEROID_COLOR_MAIN = '#A0522D';
    const ASTEROID_COLOR_DETAIL = '#693d1a';
    const POWERUP_SHIELD_COLOR = '#00BFFF';
    const POWERUP_MULTI_COLOR = '#FF4500';

    const STARFIELD_LAYERS = 3;
    const STARS_PER_LAYER = [50, 70, 100];
    const STARFIELD_SPEEDS = [0.1, 0.25, 0.5];

    // *** Adjusted Difficulty Curve ***
    const INITIAL_SPAWN_RATE = 0.015;      // Start slightly slower
    const MAX_SPAWN_RATE = 0.05;           // Max rate slightly lower
    const SPAWN_RATE_INCREASE = 0.000005;  // Much slower increase
    const INITIAL_ITEM_SPEED = 2.0;        // Start slightly slower
    const MAX_ITEM_SPEED = 7.5;            // Max speed slightly lower
    const ITEM_SPEED_INCREASE = 0.0003;   // Much slower increase
    // *** End Adjusted Difficulty Curve ***
    const POWERUP_SPAWN_CHANCE = 0.006; // Slightly higher chance for powerups

    const PARTICLE_COUNT = 20;
    const PARTICLE_LIFESPAN = 40;
    const PARTICLE_SPEED = 3;
    const SHAKE_DURATION = 15;
    const SHAKE_MAGNITUDE = 4;
    const MULTIPLIER_DURATION = 450; // Slightly longer duration

    // --- Game State Variables ---
    let score = 0;
    let lives = MAX_LIVES;
    let gameOver = false;
    let isGameStarted = false;
    let starLayers = [];
    let spawnRate = INITIAL_SPAWN_RATE;
    let itemSpeed = INITIAL_ITEM_SPEED;
    let particles = [];
    let screenShake = { duration: 0, magnitude: 0 };
    let playerInvincible = false;
    let invincibilityTimer = 0;
    let scoreMultiplier = 1;
    let multiplierTimer = 0;
    let frameCount = 0; // Used for animations/timers

    const player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: PLAYER_BASE_Y,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        vx: 0, // Current horizontal velocity
        ax: 0  // Current horizontal acceleration (set by input)
    };

    let items = [];

    const keys = {
        ArrowLeft: false,
        ArrowRight: false
    };

    // --- Audio Placeholder (Same as before) ---
    const sounds = {};
    function loadAudio(key, src) { console.warn(`Audio loading disabled. Would load: ${key} from ${src}`); }
    function playSound(key, volume = 0.7) { console.warn(`Audio playing disabled. Would play: ${key}`); }
    // loadAudio('music', 'assets/music.mp3'); /* etc. */


    // --- Utility Functions (Collision, Shake, Starfield, Particles - unchanged) ---
    function checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    function triggerScreenShake(duration, magnitude) { /* ... */
        screenShake.duration = Math.max(screenShake.duration, duration);
        screenShake.magnitude = Math.max(screenShake.magnitude, magnitude);
    }
    function createStarfield() { /* ... */
        starLayers = [];
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            let stars = [];
            for (let i = 0; i < STARS_PER_LAYER[layer]; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * (1.5 - layer * 0.4) + 0.5
                });
            }
            starLayers.push(stars);
        }
        console.log("Parallax starfield created.");
    }
    function spawnParticle(x, y, color) { /* ... */
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * PARTICLE_SPEED + 1;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            lifespan: PARTICLE_LIFESPAN + Math.random() * 10,
            color: color, radius: Math.random() * 3 + 1
        });
    }
    function spawnExplosion(x, y) { /* ... */
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            spawnParticle(x, y, ASTEROID_COLOR_DETAIL);
            if (Math.random() < 0.3) spawnParticle(x, y, PLAYER_COLOR_FLAME1);
        }
    }


    // --- Game Logic Functions ---

    function spawnItem() { // Unchanged from previous version
        if (Math.random() < spawnRate) {
            const x = Math.random() * (canvas.width - ITEM_SIZE_BASE);
            const y = -ITEM_SIZE_BASE;
            let type = 'star';
            let color = STAR_COLOR;
            let size = ITEM_SIZE_BASE;
            let powerUpType = null;

            if (Math.random() < POWERUP_SPAWN_CHANCE) {
                 type = 'powerup';
                 size = ITEM_SIZE_BASE * 1.2;
                 if (Math.random() < 0.5) { powerUpType = 'shield'; color = POWERUP_SHIELD_COLOR; }
                 else { powerUpType = 'multiplier'; color = POWERUP_MULTI_COLOR; }
            }
            else if (Math.random() > 0.65) {
                 type = 'asteroid';
                 color = ASTEROID_COLOR_MAIN;
                 size = ITEM_SIZE_BASE * (Math.random() * 0.4 + 0.8);
            }

            items.push({
                x: x, y: y, size: size,
                speed: itemSpeed + (Math.random() * 1.5 - 0.75), // Add speed variation
                type: type, color: color, powerUpType: powerUpType,
                rotation: (type === 'asteroid') ? 0 : undefined,
                rotationSpeed: (type === 'asteroid') ? (Math.random() - 0.5) * 0.1 : undefined,
                pulseValue: (type === 'star') ? Math.random() : undefined,
                pulseDirection: (type === 'star') ? 1 : undefined
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

        // --- Acceleration based on input ---
        player.ax = 0; // Reset acceleration intention
        if (keys.ArrowLeft) {
            player.ax = -PLAYER_ACCELERATION;
        }
        if (keys.ArrowRight) {
            player.ax = PLAYER_ACCELERATION;
        }

        // --- Apply Acceleration & Friction ---
        player.vx += player.ax;             // Add acceleration to velocity
        player.vx *= PLAYER_FRICTION;       // Apply friction (slow down)

        // --- Clamp Velocity ---
        if (Math.abs(player.vx) > PLAYER_MAX_VX) {
            player.vx = Math.sign(player.vx) * PLAYER_MAX_VX; // Clamp to max speed
        }
        // Prevent tiny movements when stopping
        if (Math.abs(player.vx) < 0.1) {
             player.vx = 0;
        }


        // --- Apply Movement ---
        player.x += player.vx;

        // --- Keep player within bounds ---
        if (player.x < 0) {
            player.x = 0;
            player.vx = 0; // Stop velocity at boundary
        }
        if (player.x + player.width > canvas.width) {
            player.x = canvas.width - player.width;
            player.vx = 0; // Stop velocity at boundary
        }
    }

    function updateItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.y += item.speed;

            // Update item-specific properties (rotation, pulse) - unchanged
            if (item.type === 'asteroid') item.rotation += item.rotationSpeed;
            else if (item.type === 'star') { /* ... pulse logic ... */
                item.pulseValue += 0.05 * item.pulseDirection;
                if (item.pulseValue > 1 || item.pulseValue < 0.5) item.pulseDirection *= -1;
            }


            // --- Collision Check ---
            // Player rectangle for *asteroid collision* (exact size)
            const playerHitRect = { x: player.x, y: player.y, width: player.width, height: player.height };
            // Player rectangle for *item collection* (slightly wider)
            const playerCollectRect = {
                 x: player.x - COLLECT_HITBOX_LEEWAY,
                 y: player.y,
                 width: player.width + 2 * COLLECT_HITBOX_LEEWAY,
                 height: player.height
             };

            // Item hitbox (slightly smaller than visual) - unchanged
            const itemHitboxSize = item.size * 0.8;
            const itemRect = { /* ... item hitbox calc ... */
                x: item.x + (item.size - itemHitboxSize) / 2,
                y: item.y + (item.size - itemHitboxSize) / 2,
                width: itemHitboxSize,
                height: itemHitboxSize
            };

            let collided = false;
            if (item.type === 'asteroid') {
                collided = checkCollision(playerHitRect, itemRect);
            } else { // Star or Powerup - use wider collection box
                collided = checkCollision(playerCollectRect, itemRect);
            }

            if (collided) {
                if (item.type === 'star') {
                    score += scoreMultiplier;
                    playSound('collect', 0.5);
                    items.splice(i, 1);
                }
                else if (item.type === 'powerup') {
                    playSound('powerup', 0.8);
                    if (item.powerUpType === 'shield') { /* ... shield logic ... */
                        playerInvincible = true;
                        invincibilityTimer = INVINCIBILITY_DURATION * 1.5;
                    } else if (item.powerUpType === 'multiplier') { /* ... multi logic ... */
                        scoreMultiplier = 2;
                        multiplierTimer = MULTIPLIER_DURATION;
                    }
                    items.splice(i, 1);
                }
                else if (item.type === 'asteroid' && !playerInvincible) { // Hit an asteroid!
                    playSound('hit', 1.0);
                    lives--;
                    spawnExplosion(item.x + item.size / 2, item.y + item.size / 2);
                    triggerScreenShake(SHAKE_DURATION, SHAKE_MAGNITUDE);
                    items.splice(i, 1);

                    if (lives <= 0) { /* ... game over logic ... */
                        gameOver = true;
                        playSound('gameOver');
                        gameOverScreen.classList.add('visible');
                        finalScoreElement.textContent = `Final Score: ${score}`;
                        return;
                    } else { /* ... invincibility logic ... */
                        playerInvincible = true;
                        invincibilityTimer = INVINCIBILITY_DURATION;
                    }
                }
            }
            // Remove items that fall off the bottom - unchanged
            else if (item.y > canvas.height) {
                items.splice(i, 1);
            }
        }
    }

    function updatePowerUps() { // Unchanged
         /* ... multiplier timer logic ... */
        if (multiplierTimer > 0) {
            multiplierTimer--;
            if (multiplierTimer <= 0) {
                scoreMultiplier = 1;
            }
        }
    }

     function updateParticles() { // Unchanged
         /* ... particle movement and lifespan logic ... */
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.lifespan--;
            if (p.lifespan <= 0) particles.splice(i, 1);
        }
    }

    function updateDifficulty() { // Unchanged (but constants were adjusted)
        spawnRate = Math.min(MAX_SPAWN_RATE, spawnRate + SPAWN_RATE_INCREASE);
        itemSpeed = Math.min(MAX_ITEM_SPEED, itemSpeed + ITEM_SPEED_INCREASE);
    }

    function updateStarfield() { // Unchanged
         /* ... parallax star movement ... */
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            starLayers[layer].forEach(star => {
                star.y += STARFIELD_SPEEDS[layer] * (itemSpeed / INITIAL_ITEM_SPEED);
                if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; }
            });
        }
    }


    // --- Drawing Functions (Mostly unchanged, minor tweaks) ---

    function drawStarfield() { /* ... unchanged parallax drawing ... */
        ctx.fillStyle = '#FFFFFF';
        for (let layer = 0; layer < STARFIELD_LAYERS; layer++) {
            ctx.globalAlpha = 0.4 + (layer / STARFIELD_LAYERS) * 0.6;
            starLayers[layer].forEach(star => {
                ctx.beginPath(); ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); ctx.fill();
            });
        }
        ctx.globalAlpha = 1.0;
    }

    function drawPlayer() {
        // Flash player if invincible - unchanged
        if (playerInvincible && Math.floor(invincibilityTimer / 5) % 2 === 0) return; // Slightly faster flash

        // Draw main body - unchanged
        ctx.fillStyle = PLAYER_COLOR_BODY;
        ctx.beginPath();
         ctx.moveTo(player.x + player.width / 2, player.y);
         ctx.lineTo(player.x, player.y + player.height * 0.8);
         ctx.lineTo(player.x + player.width * 0.2, player.y + player.height);
         ctx.lineTo(player.x + player.width * 0.8, player.y + player.height);
         ctx.lineTo(player.x + player.width, player.y + player.height * 0.8);
        ctx.closePath();
        ctx.fill();

        // Draw 'window' - unchanged
        ctx.fillStyle = PLAYER_COLOR_WINDOW;
        ctx.fillRect(player.x + player.width * 0.3, player.y + player.height * 0.2, player.width * 0.4, player.height * 0.3);

        // Draw flickering flame exhaust - ** base flame proportional to speed **
        const speedRatio = Math.abs(player.vx) / PLAYER_MAX_VX; // 0 to 1 based on current speed
        const baseFlameHeight = player.height * (0.2 + speedRatio * 0.8); // Minimum flame, scales up with speed
        const flicker = baseFlameHeight * (0.7 + Math.random() * 0.6); // Add random flicker on top
        const flameHeight = Math.max(5, flicker); // Ensure minimum flame size
        const flameWidth = player.width * (0.2 + speedRatio * 0.3 + Math.random() * 0.1);
        const flameOffsetX = (player.width - flameWidth) / 2;

        // Outer flame (Red) - unchanged drawing logic
        ctx.fillStyle = PLAYER_COLOR_FLAME2;
        ctx.beginPath();
         ctx.moveTo(player.x + flameOffsetX, player.y + player.height);
         ctx.lineTo(player.x + player.width - flameOffsetX, player.y + player.height);
         ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameHeight);
        ctx.closePath();
        ctx.fill();

         // Inner flame (Orange) - unchanged drawing logic
        ctx.fillStyle = PLAYER_COLOR_FLAME1;
        ctx.beginPath();
         ctx.moveTo(player.x + flameOffsetX + 2, player.y + player.height);
         ctx.lineTo(player.x + player.width - flameOffsetX - 2, player.y + player.height);
         ctx.lineTo(player.x + player.width / 2, player.y + player.height + flameHeight * 0.6);
        ctx.closePath();
        ctx.fill();

         // --- DEBUG: Draw Collection Hitbox ---
        // if (debugMode) {
        //     ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        //     ctx.lineWidth = 1;
        //     ctx.strokeRect(player.x - COLLECT_HITBOX_LEEWAY, player.y, player.width + 2 * COLLECT_HITBOX_LEEWAY, player.height);
        // }
    }

    function drawItems() { // Unchanged drawing logic for stars, asteroids, powerups
         items.forEach(item => {
            if (item.type === 'star') { /* ... pulsing star drawing ... */
                const size = item.size * item.pulseValue;
                const alpha = 0.7 + (item.pulseValue - 0.5) * 0.6;
                ctx.fillStyle = STAR_COLOR; ctx.globalAlpha = alpha;
                ctx.beginPath();
                 ctx.moveTo(item.x + size / 2, item.y); ctx.lineTo(item.x + size * 0.65, item.y + size * 0.35);
                 ctx.lineTo(item.x + size, item.y + size / 2); ctx.lineTo(item.x + size * 0.65, item.y + size * 0.65);
                 ctx.lineTo(item.x + size / 2, item.y + size); ctx.lineTo(item.x + size * 0.35, item.y + size * 0.65);
                 ctx.lineTo(item.x, item.y + size / 2); ctx.lineTo(item.x + size * 0.35, item.y + size * 0.35);
                ctx.closePath(); ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            else if (item.type === 'asteroid') { /* ... rotating asteroid drawing ... */
                ctx.save();
                 ctx.translate(item.x + item.size / 2, item.y + item.size / 2); ctx.rotate(item.rotation);
                 ctx.fillStyle = ASTEROID_COLOR_MAIN; ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
                 ctx.fillStyle = ASTEROID_COLOR_DETAIL;
                 ctx.fillRect(-item.size * 0.3, -item.size * 0.3, item.size * 0.3, item.size * 0.3);
                 ctx.fillRect(item.size * 0.1, 0, item.size * 0.2, item.size * 0.2);
                ctx.restore();
            }
            else if (item.type === 'powerup') { /* ... powerup drawing ... */
                 ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2); ctx.fill();
                 ctx.fillStyle = 'white'; ctx.font = `bold ${item.size * 0.6}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                 const text = (item.powerUpType === 'shield') ? 'S' : 'x2';
                 ctx.fillText(text, item.x + item.size / 2, item.y + item.size / 2 + 1);
                 ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            }
        });
    }

    function drawParticles() { // Unchanged
        /* ... fade out particles ... */
        particles.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.lifespan / PARTICLE_LIFESPAN);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    function drawUI() {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Consolas, "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle'; // Align text vertically better

        // Draw Score
        ctx.fillText(`Score: ${score}`, 15, 30);

        // Draw Lives
        let livesX = canvas.width - 15;
        ctx.textAlign = 'right'; // Align hearts to the right
        ctx.fillStyle = '#FF6347';
        for (let i = 0; i < lives; i++) {
            ctx.fillText('\u2665', livesX, 30); // Draw heart
            livesX -= 30; // Move left for the next heart
        }
         ctx.textAlign = 'left'; // Reset alignment

        // Draw Multiplier Status (with visual pulse/glow)
        if (multiplierTimer > 0) {
            const pulse = Math.abs(Math.sin(frameCount * 0.1)); // 0 to 1 pulse
            ctx.fillStyle = POWERUP_MULTI_COLOR;
            ctx.font = `bold ${26 + pulse * 4}px Consolas, "Courier New", monospace`; // Size pulse
            ctx.globalAlpha = 0.8 + pulse * 0.2; // Alpha pulse
            ctx.textAlign = 'center';
            ctx.fillText(`x2 SCORE!`, canvas.width / 2, 30);
            ctx.globalAlpha = 1.0; // Reset alpha
            ctx.textAlign = 'left'; // Reset alignment
        }

         // Draw Shield Status (maybe outline player when active?)
         if (playerInvincible && invincibilityTimer > 0) {
             // Draw outline around player instead of text?
             ctx.strokeStyle = POWERUP_SHIELD_COLOR;
             ctx.lineWidth = 3;
             ctx.globalAlpha = 0.4 + Math.abs(Math.sin(frameCount * 0.15)) * 0.5; // Pulsing alpha
             // Re-draw player outline slightly larger
              ctx.beginPath();
               ctx.moveTo(player.x + player.width / 2, player.y-2);
               ctx.lineTo(player.x-2, player.y + player.height * 0.8);
               ctx.lineTo(player.x + player.width * 0.2 - 2, player.y + player.height+2);
               ctx.lineTo(player.x + player.width * 0.8 + 2, player.y + player.height+2);
               ctx.lineTo(player.x + player.width+2, player.y + player.height * 0.8);
              ctx.closePath();
             ctx.stroke();
             ctx.globalAlpha = 1.0; // Reset alpha
             // Or keep the text indicator:
             // ctx.fillStyle = POWERUP_SHIELD_COLOR;
             // ctx.font = 'bold 20px Consolas, "Courier New", monospace';
             // ctx.fillText(`SHIELD`, canvas.width - 150, 60);
         }
         ctx.textBaseline = 'alphabetic'; // Reset baseline
    }

    // --- Game Loop ---
    function gameLoop() {
        frameCount++; // Increment frame counter every frame

        if (!isGameStarted) { /* ... unchanged start screen logic ... */
             ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
             if (starLayers.length > 0) drawStarfield();
            requestAnimationFrame(gameLoop);
            return;
        }
        if (gameOver) { /* ... unchanged game over logic ... */
            ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawStarfield(); drawItems(); drawParticles(); drawPlayer();
            requestAnimationFrame(gameLoop);
            return;
        }

        // --- Pre-drawing state reset & Screen Shake ---
        ctx.save();
         let shakeX = 0, shakeY = 0; /* ... screen shake application ... */
         if (screenShake.duration > 0) {
             shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
             shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
             ctx.translate(shakeX, shakeY);
             screenShake.duration--;
             if (screenShake.duration <= 0) screenShake.magnitude = 0;
         }

        // --- Clear Canvas ---
        ctx.fillStyle = '#000000';
        ctx.fillRect(-shakeX, -shakeY, canvas.width + Math.abs(shakeX * 2), canvas.height + Math.abs(shakeY*2));

        // --- Updates ---
        updateStarfield();
        updatePlayer();    // Now uses acceleration/friction
        updatePowerUps();
        spawnItem();
        updateItems();     // Uses updated player collision rects
        updateParticles();
        updateDifficulty(); // Slower increase

        // --- Drawing ---
        drawStarfield();
        drawParticles();
        drawItems();
        drawPlayer();      // Flame now reflects speed
        drawUI();          // With multiplier indicator

        ctx.restore();

        requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    function initGame() { // Unchanged logic, just resets new variables
        console.log("Initializing game state...");
        score = 0; lives = MAX_LIVES; gameOver = false; isGameStarted = true;
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2; player.vx = 0; player.ax = 0; // Reset physics
        items = []; particles = [];
        spawnRate = INITIAL_SPAWN_RATE; itemSpeed = INITIAL_ITEM_SPEED;
        playerInvincible = false; invincibilityTimer = 0;
        scoreMultiplier = 1; multiplierTimer = 0;
        screenShake = { duration: 0, magnitude: 0 }; frameCount = 0;
        keys.ArrowLeft = false; keys.ArrowRight = false;

        if (starLayers.length === 0) createStarfield();
        startScreen.classList.remove('visible'); gameOverScreen.classList.remove('visible');
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
        // playSound('music', 0.4);

        console.log("Starting main game loop...");
        requestAnimationFrame(gameLoop);
    }

     // Input Handlers (Unchanged)
     function handleKeyDown(e) { /* ... start/restart/movement logic ... */
         if (!isGameStarted && e.code === 'Enter') { initGame(); return; }
         if (gameOver && e.code === 'Enter') { initGame(); return; }
         if (isGameStarted && !gameOver) {
             if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
             if (e.code === 'ArrowRight') keys.ArrowRight = true;
         }
     }
     function handleKeyUp(e) { /* ... key release logic ... */
         if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
         if (e.code === 'ArrowRight') keys.ArrowRight = false;
     }

    // --- Initial Setup ---
    createStarfield();
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); drawStarfield();
    window.addEventListener('keydown', handleKeyDown); // Only need keydown initially for starting
    console.log("Game setup complete. Waiting for user to start.");

}); // End DOMContentLoaded
