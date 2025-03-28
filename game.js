console.log("Cosmic Collector Final FX game.js starting...");

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
    const PLAYER_ACCELERATION = 0.6;
    const PLAYER_FRICTION = 0.92;
    const PLAYER_MAX_VX = 7;
    const PLAYER_COLOR_BODY = '#00FF00';
    const PLAYER_COLOR_WINDOW = '#ADD8E6';
    const PLAYER_COLOR_FLAME1 = '#FFA500';
    const PLAYER_COLOR_FLAME2 = '#FF0000';
    const MAX_LIVES = 3;
    const INVINCIBILITY_DURATION = 120;
    const COLLECT_HITBOX_LEEWAY = 5;

    const ITEM_SIZE_BASE = 18;
    const POWERUP_SIZE_MULTIPLIER = 1.6; // *** Make powerups bigger ***
    const STAR_COLOR = '#FFFF00';
    const ASTEROID_COLOR_MAIN = '#A0522D';
    const ASTEROID_COLOR_DETAIL = '#693d1a';
    const POWERUP_SHIELD_COLOR = '#00BFFF';
    const POWERUP_MULTI_COLOR = '#FF4500';

    const STARFIELD_LAYERS = 3;
    const STARS_PER_LAYER = [50, 70, 100];
    const STARFIELD_SPEEDS = [0.1, 0.25, 0.5];

    const INITIAL_SPAWN_RATE = 0.015;
    const MAX_SPAWN_RATE = 0.05;
    const SPAWN_RATE_INCREASE = 0.000005;
    const INITIAL_ITEM_SPEED = 2.0;
    const MAX_ITEM_SPEED = 7.5;
    const ITEM_SPEED_INCREASE = 0.0003;
    const POWERUP_SPAWN_CHANCE = 0.006;

    const PARTICLE_COUNT_EXPLOSION = 20;
    const PARTICLE_COUNT_COLLECT = 8; // Fewer for collection
    const PARTICLE_LIFESPAN = 40;
    const PARTICLE_SPEED_EXPLOSION = 3;
    const PARTICLE_SPEED_COLLECT = 2; // Slower for collection
    const SHAKE_DURATION = 15;
    const SHAKE_MAGNITUDE = 4;
    const MULTIPLIER_DURATION = 450;

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
    let frameCount = 0;

    const player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: PLAYER_BASE_Y,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        vx: 0, ax: 0
    };

    let items = [];

    const keys = {
        ArrowLeft: false,
        ArrowRight: false
    };

    // --- Audio Implementation ---
    const sounds = {};
    let canPlayAudio = false; // Flag to check if audio context is ready

    function loadAudio(key, src, loop = false) {
        // Check if AudioContext is available
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn("AudioContext not supported. Audio disabled.");
            return;
        }

        // Create AudioContext on first load (or user interaction) if needed
        // User interaction might be required for AudioContext to start in some browsers.
        // We'll rely on the initial 'Enter' press to hopefully enable it.

        try {
            const audio = new Audio(src);
            audio.loop = loop;
            audio.preload = 'auto'; // Suggest browser to load
            audio.addEventListener('canplaythrough', () => {
                console.log(`Audio ready: ${key}`);
                canPlayAudio = true; // Mark audio as potentially playable
            }, { once: true });
            audio.addEventListener('error', (e) => {
                 console.error(`Error loading audio ${key}:`, e);
            });
            audio.load(); // Explicitly call load
            sounds[key] = audio;
            console.log(`Attempting to load audio: ${key}`);
        } catch (e) {
            console.error(`Error creating Audio object for ${key}:`, e);
        }
    }

    function playSound(key, volume = 0.7) {
        if (!canPlayAudio) {
             // console.log(`Audio Context not ready, skipping sound: ${key}`);
             return;
        }
        if (sounds[key]) {
            try {
                 // Stop previous playback and rewind only if necessary (prevents cutting off rapid sounds)
                 if (!sounds[key].paused) {
                     sounds[key].pause();
                 }
                sounds[key].currentTime = 0;
                sounds[key].volume = Math.max(0, Math.min(1, volume));
                // play() returns a Promise
                const playPromise = sounds[key].play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Autoplay was prevented or other error
                        // console.warn(`Playback failed for ${key}: ${error.message}`);
                        // We might need user interaction to enable sounds globally
                        canPlayAudio = false; // Assume context needs interaction if play fails
                        console.warn("Audio playback failed. Might require user interaction first.");
                    });
                }
            } catch (e) {
                console.error(`Error playing sound ${key}:`, e);
            }
        } else {
            console.warn(`Sound key not found: ${key}`);
        }
    }

    // --- Load Audio Assets ---
    loadAudio('music', 'assets/music.mp3', true); // Loop background music
    loadAudio('collect', 'assets/collect.mp3');
    loadAudio('hit', 'assets/hit.mp3');
    loadAudio('powerup', 'assets/powerup.mp3');
    // Optional: loadAudio('gameOver', 'assets/gameOver.mp3');


    // --- Utility Functions (Collision, Shake, Starfield - unchanged) ---
    function checkCollision(rect1, rect2) { /* ... */ return rect1.x<rect2.x+rect2.width&&rect1.x+rect1.width>rect2.x&&rect1.y<rect2.y+rect2.height&&rect1.y+rect1.height>rect2.y; }
    function triggerScreenShake(duration, magnitude) { /* ... */ screenShake.duration = Math.max(screenShake.duration, duration); screenShake.magnitude = Math.max(screenShake.magnitude, magnitude); }
    function createStarfield() { /* ... unchanged ... */ starLayers=[];for(let l=0;l<STARFIELD_LAYERS;l++){let s=[];for(let i=0;i<STARS_PER_LAYER[l];i++){s.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,radius:Math.random()*(1.5-l*.4)+.5})}starLayers.push(s)}console.log("Parallax starfield created."); }

    // --- Particle Functions ---
    function spawnParticle(x, y, options = {}) {
        const defaults = {
             count: 1,
             color: '#FFFFFF',
             speed: PARTICLE_SPEED_EXPLOSION,
             lifespan: PARTICLE_LIFESPAN,
             radiusRange: [1, 3],
             angleSpread: Math.PI * 2, // Full circle
             baseAngle: Math.random() * Math.PI * 2 // Random direction
        };
        const settings = { ...defaults, ...options };

        for(let i = 0; i < settings.count; i++) {
            const angle = settings.baseAngle + (Math.random() - 0.5) * settings.angleSpread;
            const speedVariance = settings.speed * (0.7 + Math.random() * 0.6); // Add variance
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speedVariance,
                vy: Math.sin(angle) * speedVariance,
                lifespan: settings.lifespan * (0.8 + Math.random() * 0.4),
                color: settings.color,
                radius: settings.radiusRange[0] + Math.random() * (settings.radiusRange[1] - settings.radiusRange[0]),
                friction: 0.98 // Optional friction
            });
        }
    }

    function spawnExplosion(x, y) {
         spawnParticle(x, y, {
             count: PARTICLE_COUNT_EXPLOSION,
             color: ASTEROID_COLOR_DETAIL,
             speed: PARTICLE_SPEED_EXPLOSION,
             lifespan: PARTICLE_LIFESPAN * 1.2 // Slightly longer
         });
         // Add some player-colored sparks to the explosion
         spawnParticle(x, y, {
             count: Math.floor(PARTICLE_COUNT_EXPLOSION * 0.3),
             color: PLAYER_COLOR_FLAME1,
             speed: PARTICLE_SPEED_EXPLOSION * 1.2, // Faster sparks
             lifespan: PARTICLE_LIFESPAN * 0.8,
             radiusRange: [0.5, 2]
         });
    }

    function spawnCollectEffect(x, y, color) {
         spawnParticle(x, y, {
             count: PARTICLE_COUNT_COLLECT,
             color: color,
             speed: PARTICLE_SPEED_COLLECT,
             lifespan: PARTICLE_LIFESPAN * 0.6, // Shorter lifespan
             radiusRange: [1, 2.5],
             angleSpread: Math.PI * 2 // Burst outwards
         });
    }


    // --- Game Logic Functions ---

    function spawnItem() {
        if (Math.random() < spawnRate) {
            const x = Math.random() * (canvas.width - ITEM_SIZE_BASE);
            const y = -ITEM_SIZE_BASE * 2; // Spawn slightly higher up
            let type = 'star';
            let color = STAR_COLOR;
            let size = ITEM_SIZE_BASE;
            let powerUpType = null;

            if (Math.random() < POWERUP_SPAWN_CHANCE) {
                 type = 'powerup';
                 size = ITEM_SIZE_BASE * POWERUP_SIZE_MULTIPLIER; // *** Apply size multiplier ***
                 if (Math.random() < 0.5) { powerUpType = 'shield'; color = POWERUP_SHIELD_COLOR; }
                 else { powerUpType = 'multiplier'; color = POWERUP_MULTI_COLOR; }
            }
            else if (Math.random() > 0.65) {
                 type = 'asteroid';
                 color = ASTEROID_COLOR_MAIN;
                 size = ITEM_SIZE_BASE * (Math.random() * 0.4 + 0.8);
            }

            items.push({ /* ... unchanged item properties ... */
                x: x, y: y, size: size,
                speed: itemSpeed + (Math.random() * 1.5 - 0.75),
                type: type, color: color, powerUpType: powerUpType,
                rotation: (type === 'asteroid') ? 0 : undefined,
                rotationSpeed: (type === 'asteroid') ? (Math.random() - 0.5) * 0.1 : undefined,
                pulseValue: (type === 'star') ? Math.random() : undefined,
                pulseDirection: (type === 'star') ? 1 : undefined
            });
        }
    }

    function updatePlayer() { // Unchanged physics logic
        if (playerInvincible) { invincibilityTimer--; if (invincibilityTimer <= 0) playerInvincible = false; }
        player.ax = 0; if (keys.ArrowLeft) player.ax = -PLAYER_ACCELERATION; if (keys.ArrowRight) player.ax = PLAYER_ACCELERATION;
        player.vx += player.ax; player.vx *= PLAYER_FRICTION;
        if (Math.abs(player.vx) > PLAYER_MAX_VX) player.vx = Math.sign(player.vx) * PLAYER_MAX_VX;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
        player.x += player.vx;
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.width > canvas.width) { player.x = canvas.width - player.width; player.vx = 0; }
    }

    function updateItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.y += item.speed;

            if (item.type === 'asteroid') item.rotation += item.rotationSpeed;
            else if (item.type === 'star') { item.pulseValue += 0.05 * item.pulseDirection; if (item.pulseValue > 1 || item.pulseValue < 0.5) item.pulseDirection *= -1; }

            const playerHitRect = { x: player.x, y: player.y, width: player.width, height: player.height };
            const playerCollectRect = { x: player.x - COLLECT_HITBOX_LEEWAY, y: player.y, width: player.width + 2 * COLLECT_HITBOX_LEEWAY, height: player.height };
            const itemHitboxSize = item.size * 0.8;
            const itemRect = { x: item.x + (item.size - itemHitboxSize)/2, y: item.y + (item.size - itemHitboxSize)/2, width: itemHitboxSize, height: itemHitboxSize };

            let collided = (item.type === 'asteroid') ? checkCollision(playerHitRect, itemRect) : checkCollision(playerCollectRect, itemRect);

            if (collided) {
                const itemCenterX = item.x + item.size / 2;
                const itemCenterY = item.y + item.size / 2;

                if (item.type === 'star') {
                    score += scoreMultiplier;
                    playSound('collect', 0.6); // Slightly lower volume for collect
                    spawnCollectEffect(itemCenterX, itemCenterY, STAR_COLOR); // *** Spawn effect ***
                    items.splice(i, 1);
                }
                else if (item.type === 'powerup') {
                    playSound('powerup', 0.8);
                    spawnCollectEffect(itemCenterX, itemCenterY, item.color); // *** Spawn effect ***
                    if (item.powerUpType === 'shield') { playerInvincible = true; invincibilityTimer = INVINCIBILITY_DURATION * 1.5; }
                    else if (item.powerUpType === 'multiplier') { scoreMultiplier = 2; multiplierTimer = MULTIPLIER_DURATION; }
                    items.splice(i, 1);
                }
                else if (item.type === 'asteroid' && !playerInvincible) {
                    playSound('hit', 1.0);
                    lives--;
                    spawnExplosion(itemCenterX, itemCenterY);
                    triggerScreenShake(SHAKE_DURATION, SHAKE_MAGNITUDE);
                    items.splice(i, 1);

                    if (lives <= 0) {
                        gameOver = true;
                        // playSound('gameOver'); // Optional
                         gameOverScreen.classList.add('visible');
                         finalScoreElement.textContent = `Final Score: ${score}`;
                        return;
                    } else {
                        playerInvincible = true; invincibilityTimer = INVINCIBILITY_DURATION;
                    }
                }
            }
            else if (item.y > canvas.height) {
                items.splice(i, 1);
            }
        }
    }

    function updatePowerUps() { /* ... unchanged ... */ if(multiplierTimer>0){multiplierTimer--;if(multiplierTimer<=0){scoreMultiplier=1}}}

     function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vx *= p.friction || 1; // Apply friction if defined
            p.vy *= p.friction || 1;
            p.x += p.vx; p.y += p.vy; p.lifespan--;
            if (p.lifespan <= 0) particles.splice(i, 1);
        }
    }

    function updateDifficulty() { /* ... unchanged ... */ spawnRate=Math.min(MAX_SPAWN_RATE,spawnRate+SPAWN_RATE_INCREASE);itemSpeed=Math.min(MAX_ITEM_SPEED,itemSpeed+ITEM_SPEED_INCREASE);}
    function updateStarfield() { /* ... unchanged ... */ for(let l=0;l<STARFIELD_LAYERS;l++){starLayers[l].forEach(s=>{s.y+=STARFIELD_SPEEDS[l]*(itemSpeed/INITIAL_ITEM_SPEED);if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width}})}}


    // --- Drawing Functions ---

    function drawStarfield() { /* ... unchanged ... */ ctx.fillStyle='#FFFFFF';for(let l=0;l<STARFIELD_LAYERS;l++){ctx.globalAlpha=.4+(l/STARFIELD_LAYERS)*.6;starLayers[l].forEach(s=>{ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.fill()})}ctx.globalAlpha=1.0; }
    function drawPlayer() { /* ... unchanged ... */ if(playerInvincible&&Math.floor(invincibilityTimer/5)%2===0)return;ctx.fillStyle=PLAYER_COLOR_BODY;ctx.beginPath();ctx.moveTo(player.x+player.width/2,player.y);ctx.lineTo(player.x,player.y+player.height*.8);ctx.lineTo(player.x+player.width*.2,player.y+player.height);ctx.lineTo(player.x+player.width*.8,player.y+player.height);ctx.lineTo(player.x+player.width,player.y+player.height*.8);ctx.closePath();ctx.fill();ctx.fillStyle=PLAYER_COLOR_WINDOW;ctx.fillRect(player.x+player.width*.3,player.y+player.height*.2,player.width*.4,player.height*.3);const s=Math.abs(player.vx)/PLAYER_MAX_VX;const b=player.height*(.2+s*.8);const f=b*(.7+Math.random()*.6);const h=Math.max(5,f);const w=player.width*(.2+s*.3+Math.random()*.1);const o=(player.width-w)/2;ctx.fillStyle=PLAYER_COLOR_FLAME2;ctx.beginPath();ctx.moveTo(player.x+o,player.y+player.height);ctx.lineTo(player.x+player.width-o,player.y+player.height);ctx.lineTo(player.x+player.width/2,player.y+player.height+h);ctx.closePath();ctx.fill();ctx.fillStyle=PLAYER_COLOR_FLAME1;ctx.beginPath();ctx.moveTo(player.x+o+2,player.y+player.height);ctx.lineTo(player.x+player.width-o-2,player.y+player.height);ctx.lineTo(player.x+player.width/2,player.y+player.height+h*.6);ctx.closePath();ctx.fill(); }

    function drawItems() {
         items.forEach(item => {
            if (item.type === 'star') { /* ... unchanged pulsing star ... */
                const size=item.size*item.pulseValue;const alpha=.7+(item.pulseValue-.5)*.6;ctx.fillStyle=STAR_COLOR;ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(item.x+size/2,item.y);ctx.lineTo(item.x+size*.65,item.y+size*.35);ctx.lineTo(item.x+size,item.y+size/2);ctx.lineTo(item.x+size*.65,item.y+size*.65);ctx.lineTo(item.x+size/2,item.y+size);ctx.lineTo(item.x+size*.35,item.y+size*.65);ctx.lineTo(item.x,item.y+size/2);ctx.lineTo(item.x+size*.35,item.y+size*.35);ctx.closePath();ctx.fill();ctx.globalAlpha=1.0;
            }
            else if (item.type === 'asteroid') { /* ... unchanged rotating asteroid ... */
                ctx.save();ctx.translate(item.x+item.size/2,item.y+item.size/2);ctx.rotate(item.rotation);ctx.fillStyle=ASTEROID_COLOR_MAIN;ctx.fillRect(-item.size/2,-item.size/2,item.size,item.size);ctx.fillStyle=ASTEROID_COLOR_DETAIL;ctx.fillRect(-item.size*.3,-item.size*.3,item.size*.3,item.size*.3);ctx.fillRect(item.size*.1,0,item.size*.2,item.size*.2);ctx.restore();
            }
            else if (item.type === 'powerup') { // Adjusted text size
                 ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2); ctx.fill();
                 ctx.fillStyle = 'white';
                 const fontSize = item.size * 0.55; // *** Adjusted font size calc ***
                 ctx.font = `bold ${fontSize}px Arial`;
                 ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                 const text = (item.powerUpType === 'shield') ? 'S' : 'x2';
                 ctx.fillText(text, item.x + item.size / 2, item.y + item.size / 2 + 1); // Render text
                 ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; // Reset
            }
        });
    }

    function drawParticles() {
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.lifespan / (PARTICLE_LIFESPAN * 0.8)); // Faster fade for collect particles
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    function drawUI() { // Unchanged
        /* ... score, lives, multiplier, shield drawing ... */
        ctx.fillStyle='#FFFFFF';ctx.font='24px Consolas,"Courier New",monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(`Score: ${score}`,15,30);let livesX=canvas.width-15;ctx.textAlign='right';ctx.fillStyle='#FF6347';for(let i=0;i<lives;i++){ctx.fillText('\u2665',livesX,30);livesX-=30}ctx.textAlign='left';if(multiplierTimer>0){const pulse=Math.abs(Math.sin(frameCount*.1));ctx.fillStyle=POWERUP_MULTI_COLOR;ctx.font=`bold ${26+pulse*4}px Consolas,"Courier New",monospace`;ctx.globalAlpha=.8+pulse*.2;ctx.textAlign='center';ctx.fillText(`x2 SCORE!`,canvas.width/2,30);ctx.globalAlpha=1.0;ctx.textAlign='left'}if(playerInvincible&&invincibilityTimer>0){ctx.strokeStyle=POWERUP_SHIELD_COLOR;ctx.lineWidth=3;ctx.globalAlpha=.4+Math.abs(Math.sin(frameCount*.15))*.5;ctx.beginPath();ctx.moveTo(player.x+player.width/2,player.y-2);ctx.lineTo(player.x-2,player.y+player.height*.8);ctx.lineTo(player.x+player.width*.2-2,player.y+player.height+2);ctx.lineTo(player.x+player.width*.8+2,player.y+player.height+2);ctx.lineTo(player.x+player.width+2,player.y+player.height*.8);ctx.closePath();ctx.stroke();ctx.globalAlpha=1.0}ctx.textBaseline='alphabetic';
    }

    // --- Game Loop ---
    function gameLoop() {
        frameCount++;
        if (!isGameStarted) { /* ... start screen ... */ ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);if(starLayers.length>0)drawStarfield();requestAnimationFrame(gameLoop);return; }
        if (gameOver) { /* ... game over screen ... */ ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);drawStarfield();drawItems();drawParticles();drawPlayer();requestAnimationFrame(gameLoop);return; }

        ctx.save();
         let shakeX=0,shakeY=0; if(screenShake.duration>0){shakeX=(Math.random()-.5)*2*screenShake.magnitude;shakeY=(Math.random()-.5)*2*screenShake.magnitude;ctx.translate(shakeX,shakeY);screenShake.duration--;if(screenShake.duration<=0)screenShake.magnitude=0;}
        ctx.fillStyle='#000000';ctx.fillRect(-shakeX,-shakeY,canvas.width+Math.abs(shakeX*2),canvas.height+Math.abs(shakeY*2));

        updateStarfield(); updatePlayer(); updatePowerUps(); spawnItem(); updateItems(); updateParticles(); updateDifficulty();
        drawStarfield(); drawParticles(); drawItems(); drawPlayer(); drawUI();

        ctx.restore();
        requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    function initGame() {
        console.log("Initializing game state...");
        score=0;lives=MAX_LIVES;gameOver=false;isGameStarted=true;
        player.x=canvas.width/2-PLAYER_WIDTH/2;player.vx=0;player.ax=0;
        items=[];particles=[];
        spawnRate=INITIAL_SPAWN_RATE;itemSpeed=INITIAL_ITEM_SPEED;
        playerInvincible=false;invincibilityTimer=0;
        scoreMultiplier=1;multiplierTimer=0;
        screenShake={duration:0,magnitude:0};frameCount=0;
        keys.ArrowLeft=false;keys.ArrowRight=false;

        if(starLayers.length===0)createStarfield();
        startScreen.classList.remove('visible');gameOverScreen.classList.remove('visible');
        window.addEventListener('keydown',handleKeyDown);window.addEventListener('keyup',handleKeyUp);

        // Try to start music (requires user interaction usually)
        playSound('music', 0.4);

        console.log("Starting main game loop...");
        requestAnimationFrame(gameLoop);
    }

     // Input Handlers
     function handleKeyDown(e) {
         // Handle starting audio context with first Enter press
         if (!isGameStarted && e.code === 'Enter') {
             canPlayAudio = true; // Assume interaction enables audio
             initGame();
             return;
         }
         if (gameOver && e.code === 'Enter') {
             initGame();
             return;
         }
         if (isGameStarted && !gameOver) {
             if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
             if (e.code === 'ArrowRight') keys.ArrowRight = true;
         }
     }
     function handleKeyUp(e) { if(e.code==='ArrowLeft')keys.ArrowLeft=false;if(e.code==='ArrowRight')keys.ArrowRight=false;}

    // --- Initial Setup ---
    createStarfield();
    ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);drawStarfield();
    window.addEventListener('keydown',handleKeyDown);
    console.log("Game setup complete. Waiting for user to start.");

}); // End DOMContentLoaded


