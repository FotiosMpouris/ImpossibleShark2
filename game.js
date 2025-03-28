console.log("Cosmic Collector vs Crab game.js starting...");

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const transitionScreen = document.getElementById('transition-screen'); // Added
    const finalScoreElement = document.getElementById('final-score');

    if (!canvas || !startScreen || !gameOverScreen || !transitionScreen || !finalScoreElement) {
        console.error("HTML elements (canvas or overlays) not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Failed to get 2D context!"); return; }

    // --- Game State ---
    let gameState = 'START_SCREEN'; // 'START_SCREEN', 'COSMIC_COLLECTOR', 'CRAB_FIGHT_TRANSITION', 'CRAB_FIGHT', 'COLLECTOR_TRANSITION', 'GAME_OVER'
    let globalScore = 0; // Keep track of overall score if needed across modes

    // --- Constants ---
    const CRAB_FIGHT_SCORE_THRESHOLD = 10;
    const CRAB_BOSS_HITS_NEEDED = 10;
    const TRANSITION_DURATION = 90; // Frames for fade transition

    // == Cosmic Collector Constants ==
    const CC_PLAYER_WIDTH = 45; const CC_PLAYER_HEIGHT = 25; const CC_PLAYER_BASE_Y = canvas.height - CC_PLAYER_HEIGHT - 15;
    const CC_PLAYER_ACCELERATION = 0.6; const CC_PLAYER_FRICTION = 0.92; const CC_PLAYER_MAX_VX = 7;
    const CC_MAX_LIVES = 3; const CC_INVINCIBILITY_DURATION = 120; const CC_COLLECT_HITBOX_LEEWAY = 5;
    const CC_ITEM_SIZE_BASE = 18; const CC_POWERUP_SIZE_MULTIPLIER = 1.6;
    const CC_STAR_COLOR = '#FFFF00'; const CC_ASTEROID_COLOR_MAIN = '#A0522D'; const CC_ASTEROID_COLOR_DETAIL = '#693d1a';
    const CC_POWERUP_SHIELD_COLOR = '#00BFFF'; const CC_POWERUP_MULTI_COLOR = '#FF4500';
    const CC_STARFIELD_LAYERS = 3; const CC_STARS_PER_LAYER = [50, 70, 100]; const CC_STARFIELD_SPEEDS = [0.1, 0.25, 0.5];
    const CC_INITIAL_SPAWN_RATE = 0.015; const CC_MAX_SPAWN_RATE = 0.05; const CC_SPAWN_RATE_INCREASE = 0.000005;
    const CC_INITIAL_ITEM_SPEED = 2.0; const CC_MAX_ITEM_SPEED = 7.5; const CC_ITEM_SPEED_INCREASE = 0.0003;
    const CC_POWERUP_SPAWN_CHANCE = 0.006;
    const CC_PARTICLE_COUNT_EXPLOSION = 20; const CC_PARTICLE_COUNT_COLLECT = 8;
    const CC_PARTICLE_LIFESPAN = 40; const CC_PARTICLE_SPEED_EXPLOSION = 3; const CC_PARTICLE_SPEED_COLLECT = 2;
    const CC_SHAKE_DURATION = 15; const CC_SHAKE_MAGNITUDE = 4; const CC_MULTIPLIER_DURATION = 450;

    // == Crab Fight Constants ==
    // Adapt Impossible Shark dimensions/positions for 800x600 canvas
    const CF_GROUND_Y = canvas.height - 50; // Visual ground line
    const CF_ERIC_WIDTH = 600; // Adjust these based on sprite appearance at 800x600
    const CF_ERIC_HEIGHT = 350;
    const CF_ERIC_X = 50; // Position Eric more to the left
    const CF_ERIC_Y = CF_GROUND_Y - CF_ERIC_HEIGHT + 30; // Position Eric's feet near ground
    const CF_CRAB_WIDTH = 650; // Adjust
    const CF_CRAB_HEIGHT = 350;
    const CF_CRAB_Y = CF_GROUND_Y - CF_CRAB_HEIGHT + 80; // Position crab higher
    const CF_CRAB_SPEED = 3.5;
    const CF_CRUNCH_ACTIVE_FRAMES = 20; // Duration crunch hitbox is active
    const CF_CRUNCH_ANIMATION_DURATION = 35; // Total duration of crunch animation/state
    const CF_CRAB_HIT_STUN_DURATION = 25; // How long crab is stunned after hit
    const CF_CRAB_DEATH_ANIMATION_DURATION = 60;
    // Eric Hitbox (Relative to CF_ERIC_X, CF_ERIC_Y) - NEEDS TUNING based on your Eric sprite
    const CF_ERIC_CRUNCH_OFFSET_X = 480; // Fine-tune this!
    const CF_ERIC_CRUNCH_OFFSET_Y = CF_ERIC_HEIGHT * 0.7;
    const CF_ERIC_CRUNCH_WIDTH = 80;
    const CF_ERIC_CRUNCH_HEIGHT = 80;
    // Crab Hitbox (Relative to crabBoss.x, crabBoss.y) - NEEDS TUNING
    const CF_CRAB_HITBOX_OFFSET_X = 200; // Fine-tune!
    const CF_CRAB_HITBOX_OFFSET_Y = CF_CRAB_HEIGHT * 0.3;
    const CF_CRAB_HITBOX_WIDTH = 250;
    const CF_CRAB_HITBOX_HEIGHT = CF_CRAB_HEIGHT * 0.6;


    // --- State Variables ---
    // CC = Cosmic Collector specific
    let cc_score = 0; // Score within the current CC session
    let cc_lives = CC_MAX_LIVES;
    let cc_starLayers = [];
    let cc_spawnRate = CC_INITIAL_SPAWN_RATE;
    let cc_itemSpeed = CC_INITIAL_ITEM_SPEED;
    let cc_particles = [];
    let cc_screenShake = { duration: 0, magnitude: 0 }; // Use this globally?
    let cc_playerInvincible = false;
    let cc_invincibilityTimer = 0;
    let cc_scoreMultiplier = 1;
    let cc_multiplierTimer = 0;
    let cc_frameCount = 0; // Use global frameCount?
    const cc_player = { x: canvas.width/2 - CC_PLAYER_WIDTH/2, y: CC_PLAYER_BASE_Y, width: CC_PLAYER_WIDTH, height: CC_PLAYER_HEIGHT, vx: 0, ax: 0 };
    let cc_items = [];
    // CF = Crab Fight specific
    let cf_ericState = 'walking'; // walking, crunching
    let cf_ericFrameX = 0;
    let cf_ericAnimTimer = 0;
    let cf_ericActionTimer = 0;
    const cf_crabBoss = {
        x: canvas.width, y: CF_CRAB_Y, width: CF_CRAB_WIDTH, height: CF_CRAB_HEIGHT,
        state: 'walking', // walking, crunched, dying
        frameX: 0, animTimer: 0, hitCount: 0, actionTimer: 0, deathTimer: 0
    };
    let cf_backgroundX = 0; // Shared for ocean/clouds
    // Global/Shared
    let frameCount = 0;
    let transitionTimer = 0;
    const keys = { ArrowLeft: false, ArrowRight: false, ArrowDown: false };

    // --- Asset Loading ---
    const assets = { images: {}, audio: {} };
    let allAssetsLoaded = false;

    function loadImage(key, src) {
        return new Promise((resolve, reject) => {
            if (!key || !src) return reject("Invalid key or src for image.");
            const img = new Image();
            img.onload = () => resolve({ key, img });
            img.onerror = (e) => { console.error(`Failed image: ${key} (${src})`, e); reject(`Failed ${key}`); };
            img.src = src;
        });
    }

    function loadAudio(key, src, loop = false) { // Reusing working audio loader
        if (!window.AudioContext && !window.webkitAudioContext) return Promise.resolve({ key, audio: null, error: "AudioContext not supported" });
        return new Promise((resolve) => {
            try {
                const audio = new Audio(src);
                audio.loop = loop; audio.preload = 'auto';
                const success = () => resolve({ key, audio });
                const fail = (e) => { console.error(`Failed audio: ${key} (${src})`, e); resolve({ key, audio: null, error: e }); };
                audio.addEventListener('canplaythrough', success, { once: true });
                audio.addEventListener('error', fail, { once: true });
                // Timeout for browsers that don't fire canplaythrough reliably?
                // setTimeout(() => { fail('Timeout'); }, 10000); // 10 sec timeout
                audio.load();
            } catch (e) { console.error(`Audio obj error ${key}:`, e); resolve({ key, audio: null, error: e }); }
        });
    }

    function playSound(key, volume = 0.7) { // Reusing working playSound
        const soundData = assets.audio[key];
        if (soundData && soundData.audio) {
             try {
                if (!soundData.audio.paused) soundData.audio.pause();
                soundData.audio.currentTime = 0;
                soundData.audio.volume = Math.max(0, Math.min(1, volume));
                const playPromise = soundData.audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => { console.warn(`Playback failed for ${key}: ${error.message}`); });
                }
            } catch (e) { console.error(`Error playing sound ${key}:`, e); }
        } else { console.warn(`Sound asset not ready/found: ${key}`); }
    }

    async function loadGameAssets() {
        const imageSources = [
            // Crab Fight Backgrounds
            { key: 'cfOceanBg', src: 'assets/ImpossibleLoop01.png' },
            { key: 'cfCloudBg', src: 'assets/ImpossibleClouds01.png' },
            // Crab Fight Eric
            { key: 'cfEricCrunch', src: 'assets/ericCrunch.png' },
            // { key: 'cfEricPinched', src: 'assets/ericPinched.png' }, // Removed pinching
            // Crab Fight Crab
            { key: 'cfCrabCrunch', src: 'assets/crabCrunch.png' },
        ];
        // Add sequences
        for (let i = 1; i <= 8; i++) imageSources.push({ key: `cfEricRun${i}`, src: `assets/EricRun${i}.png` });
        for (let i = 1; i <= 5; i++) imageSources.push({ key: `cfCrabWalk${i}`, src: `assets/crabWalk${i}.png` });
        for (let i = 1; i <= 3; i++) imageSources.push({ key: `cfCrabDead${i}`, src: `assets/crabDead${i}.png` });

        const audioSources = [
            // Cosmic Collector
            { key: 'ccMusic', src: 'assets/music.mp3', loop: true },
            { key: 'ccCollect', src: 'assets/collect.mp3' },
            { key: 'ccHit', src: 'assets/hit.mp3' },
            { key: 'ccPowerup', src: 'assets/powerup.mp3' },
            // Crab Fight
            { key: 'cfHit', src: 'assets/fuckCrab.mp3' }, // Use fuckCrab for hitting the crab
            // { key: 'cfBossMusic', src: 'assets/bossMusic.mp3', loop: true }, // Optional separate boss music
        ];

        console.log("Loading assets...");
        const imagePromises = imageSources.map(s => loadImage(s.key, s.src));
        const audioPromises = audioSources.map(s => loadAudio(s.key, s.src, s.loop));

        try {
            const results = await Promise.all([...imagePromises, ...audioPromises]);
            results.forEach(result => {
                if (result.img) assets.images[result.key] = result.img;
                if (result.audio !== undefined) assets.audio[result.key] = { audio: result.audio, error: result.error }; // Store audio object or error
            });
            allAssetsLoaded = true;
            console.log("All assets loaded/attempted.");
        } catch (error) {
            console.error("Error during asset loading:", error);
            // Display error on canvas?
            ctx.fillStyle = 'red'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`Asset Loading Error: ${error}`, canvas.width/2, canvas.height/2);
        }
    }


    // --- Utility & Transition Functions ---
    function checkCollision(rect1, rect2) { /* ... unchanged ... */ return rect1.x<rect2.x+rect2.width&&rect1.x+rect1.width>rect2.x&&rect1.y<rect2.y+rect2.height&&rect1.y+rect1.height>rect2.y; }
    function triggerScreenShake(duration, magnitude) { /* ... unchanged ... */ cc_screenShake.duration=Math.max(cc_screenShake.duration,duration);cc_screenShake.magnitude=Math.max(cc_screenShake.magnitude,magnitude);}
    function spawnParticle(x,y,options={}){/* ... unchanged ... */const d={count:1,color:'#FFF',speed:3,lifespan:40,radiusRange:[1,3],angleSpread:Math.PI*2,baseAngle:Math.random()*Math.PI*2};const s={...d,...options};for(let i=0;i<s.count;i++){const a=s.baseAngle+(Math.random()-.5)*s.angleSpread;const v=s.speed*(.7+Math.random()*.6);cc_particles.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,lifespan:s.lifespan*(.8+Math.random()*.4),color:s.color,radius:s.radiusRange[0]+Math.random()*(s.radiusRange[1]-s.radiusRange[0]),friction:.98})}}
    function spawnExplosion(x,y){/* ... unchanged ... */ spawnParticle(x,y,{count:CC_PARTICLE_COUNT_EXPLOSION,color:CC_ASTEROID_COLOR_DETAIL,speed:CC_PARTICLE_SPEED_EXPLOSION,lifespan:CC_PARTICLE_LIFESPAN*1.2});spawnParticle(x,y,{count:Math.floor(CC_PARTICLE_COUNT_EXPLOSION*.3),color:CC_PLAYER_COLOR_FLAME1,speed:CC_PARTICLE_SPEED_EXPLOSION*1.2,lifespan:CC_PARTICLE_LIFESPAN*.8,radiusRange:[.5,2]});}
    function spawnCollectEffect(x,y,color){/* ... unchanged ... */ spawnParticle(x,y,{count:CC_PARTICLE_COUNT_COLLECT,color:color,speed:CC_PARTICLE_SPEED_COLLECT,lifespan:CC_PARTICLE_LIFESPAN*.6,radiusRange:[1,2.5],angleSpread:Math.PI*2});}

    function transitionToCrabFight() {
        console.log("Transitioning to Crab Fight!");
        gameState = 'CRAB_FIGHT_TRANSITION';
        transitionTimer = TRANSITION_DURATION;
        playSound('ccHit'); // Play a hit/alert sound
        if (assets.audio.ccMusic?.audio) assets.audio.ccMusic.audio.pause(); // Stop collector music
        // Optional: Start boss music after transition?

        // Reset collector entities for clean slate on return
        cc_items = [];
        cc_particles = [];
        cc_player.vx = 0; // Stop player movement

        // Initialize Crab Fight state
        cf_ericState = 'walking';
        cf_ericFrameX = 0;
        cf_ericAnimTimer = 0;
        cf_crabBoss.x = canvas.width; // Start crab off screen
        cf_crabBoss.y = CF_CRAB_Y;
        cf_crabBoss.state = 'walking';
        cf_crabBoss.hitCount = 0;
        cf_crabBoss.frameX = 0;
        cf_crabBoss.actionTimer = 0;

        transitionScreen.classList.add('visible'); // Show transition overlay
    }

    function transitionToCollector() {
        console.log("Transitioning back to Cosmic Collector!");
        gameState = 'COLLECTOR_TRANSITION';
        transitionTimer = TRANSITION_DURATION;
        // Optional: Stop boss music
        if (assets.audio.ccMusic?.audio) assets.audio.ccMusic.audio.play(); // Resume collector music

        // Reset crab fight state
        cf_crabBoss.visible = false; // Hide crab

        // Re-initialize collector state (keep score, lives)
        cc_spawnRate = CC_INITIAL_SPAWN_RATE; // Reset difficulty? Or continue? Let's reset for now.
        cc_itemSpeed = CC_INITIAL_ITEM_SPEED;
        cc_items = []; // Clear items
        cc_particles = [];
        cc_player.x = canvas.width / 2 - CC_PLAYER_WIDTH / 2; // Center player
        cc_player.vx = 0;
        cc_playerInvincible = true; // Brief invincibility after boss
        cc_invincibilityTimer = 60;

        // Maybe add bonus points for beating crab?
        globalScore += 50; // Add to overall score
        cc_score = 0; // Reset CC session score? Or add to globalScore? Let's reset session score.

        transitionScreen.classList.remove('visible'); // Hide transition overlay
        // Start Collector game loop logic
    }


    // --- Cosmic Collector Logic ---
    function createCCStarfield() { /* ... same as createStarfield ... */ cc_starLayers=[];for(let l=0;l<CC_STARFIELD_LAYERS;l++){let s=[];for(let i=0;i<CC_STARS_PER_LAYER[l];i++){s.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,radius:Math.random()*(1.5-l*.4)+.5})}cc_starLayers.push(s)}}
    function updateCCStarfield() { /* ... same as updateStarfield, uses cc_starLayers ... */ for(let l=0;l<CC_STARFIELD_LAYERS;l++){cc_starLayers[l].forEach(s=>{s.y+=CC_STARFIELD_SPEEDS[l]*(cc_itemSpeed/CC_INITIAL_ITEM_SPEED);if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width}})}}
    function updateCCPlayer() { /* ... same as updatePlayer, uses cc_player, cc_invincibilityTimer etc ... */ if(cc_playerInvincible){cc_invincibilityTimer--;if(cc_invincibilityTimer<=0)cc_playerInvincible=false;}cc_player.ax=0;if(keys.ArrowLeft)cc_player.ax=-CC_PLAYER_ACCELERATION;if(keys.ArrowRight)cc_player.ax=CC_PLAYER_ACCELERATION;cc_player.vx+=cc_player.ax;cc_player.vx*=CC_PLAYER_FRICTION;if(Math.abs(cc_player.vx)>CC_PLAYER_MAX_VX)cc_player.vx=Math.sign(cc_player.vx)*CC_PLAYER_MAX_VX;if(Math.abs(cc_player.vx)<.1)cc_player.vx=0;cc_player.x+=cc_player.vx;if(cc_player.x<0){cc_player.x=0;cc_player.vx=0;}if(cc_player.x+cc_player.width>canvas.width){cc_player.x=canvas.width-cc_player.width;cc_player.vx=0;}}
    function updateCCItems() { /* ... same as updateItems, uses cc_items, cc_score, cc_lives etc ... */
        for(let i=cc_items.length-1;i>=0;i--){const item=cc_items[i];item.y+=item.speed;if(item.type==='asteroid')item.rotation+=item.rotationSpeed;else if(item.type==='star'){item.pulseValue+=.05*item.pulseDirection;if(item.pulseValue>1||item.pulseValue<.5)item.pulseDirection*=-1;}
        const playerHitRect={x:cc_player.x,y:cc_player.y,width:cc_player.width,height:cc_player.height};const playerCollectRect={x:cc_player.x-CC_COLLECT_HITBOX_LEEWAY,y:cc_player.y,width:cc_player.width+2*CC_COLLECT_HITBOX_LEEWAY,height:cc_player.height};const itemHitboxSize=item.size*.8;const itemRect={x:item.x+(item.size-itemHitboxSize)/2,y:item.y+(item.size-itemHitboxSize)/2,width:itemHitboxSize,height:itemHitboxSize};
        let collided=(item.type==='asteroid')?checkCollision(playerHitRect,itemRect):checkCollision(playerCollectRect,itemRect);
        if(collided){const itemCenterX=item.x+item.size/2;const itemCenterY=item.y+item.size/2;
            if(item.type==='star'){cc_score+=cc_scoreMultiplier;globalScore+=cc_scoreMultiplier;playSound('ccCollect',.6);spawnCollectEffect(itemCenterX,itemCenterY,CC_STAR_COLOR);cc_items.splice(i,1);}
            else if(item.type==='powerup'){playSound('ccPowerup',.8);spawnCollectEffect(itemCenterX,itemCenterY,item.color);if(item.powerUpType==='shield'){cc_playerInvincible=true;cc_invincibilityTimer=CC_INVINCIBILITY_DURATION*1.5;}else if(item.powerUpType==='multiplier'){cc_scoreMultiplier=2;cc_multiplierTimer=CC_MULTIPLIER_DURATION;}cc_items.splice(i,1);}
            else if(item.type==='asteroid'&&!cc_playerInvincible){playSound('ccHit',1.0);cc_lives--;spawnExplosion(itemCenterX,itemCenterY);triggerScreenShake(CC_SHAKE_DURATION,CC_SHAKE_MAGNITUDE);cc_items.splice(i,1);if(cc_lives<=0){gameState='GAME_OVER';/* playSound('gameOver'); */gameOverScreen.classList.add('visible');finalScoreElement.textContent=`Final Score: ${globalScore}`;return;}else{cc_playerInvincible=true;cc_invincibilityTimer=CC_INVINCIBILITY_DURATION;}}
        }else if(item.y>canvas.height){cc_items.splice(i,1);}}
    }
    function updateCCPowerUps() { /* ... same as updatePowerUps, uses cc_multiplierTimer ... */ if(cc_multiplierTimer>0){cc_multiplierTimer--;if(cc_multiplierTimer<=0)cc_scoreMultiplier=1;}}
    function updateCCParticles() { /* ... same as updateParticles, uses cc_particles ... */ for(let i=cc_particles.length-1;i>=0;i--){const p=cc_particles[i];p.vx*=p.friction||1;p.vy*=p.friction||1;p.x+=p.vx;p.y+=p.vy;p.lifespan--;if(p.lifespan<=0)cc_particles.splice(i,1);}}
    function updateCCDifficulty() { /* ... same as updateDifficulty, uses cc_spawnRate, cc_itemSpeed ... */ cc_spawnRate=Math.min(CC_MAX_SPAWN_RATE,cc_spawnRate+CC_SPAWN_RATE_INCREASE);cc_itemSpeed=Math.min(CC_MAX_ITEM_SPEED,cc_itemSpeed+CC_ITEM_SPEED_INCREASE);}
    function spawnCCItem() { /* ... same as spawnItem, pushes to cc_items ... */
        if(Math.random()<cc_spawnRate){const x=Math.random()*(canvas.width-CC_ITEM_SIZE_BASE);const y=-CC_ITEM_SIZE_BASE*2;let type='star';let color=CC_STAR_COLOR;let size=CC_ITEM_SIZE_BASE;let powerUpType=null;
        if(Math.random()<CC_POWERUP_SPAWN_CHANCE){type='powerup';size=CC_ITEM_SIZE_BASE*CC_POWERUP_SIZE_MULTIPLIER;if(Math.random()<.5){powerUpType='shield';color=CC_POWERUP_SHIELD_COLOR;}else{powerUpType='multiplier';color=CC_POWERUP_MULTI_COLOR;}}
        else if(Math.random()>.65){type='asteroid';color=CC_ASTEROID_COLOR_MAIN;size=CC_ITEM_SIZE_BASE*(Math.random()*.4+.8);}
        cc_items.push({x:x,y:y,size:size,speed:cc_itemSpeed+(Math.random()*1.5-.75),type:type,color:color,powerUpType:powerUpType,rotation:(type==='asteroid')?0:undefined,rotationSpeed:(type==='asteroid')?(Math.random()-.5)*.1:undefined,pulseValue:(type==='star')?Math.random():undefined,pulseDirection:(type==='star')?1:undefined});}
    }

    function updateCollector() {
        updateCCStarfield();
        updateCCPlayer();
        updateCCPowerUps();
        spawnCCItem();
        updateCCItems(); // Includes game over check
        updateCCParticles();
        if (gameState === 'COSMIC_COLLECTOR') updateCCDifficulty(); // Only increase difficulty if not game over

        // Check for transition condition
        if (cc_score >= CRAB_FIGHT_SCORE_THRESHOLD && gameState === 'COSMIC_COLLECTOR') {
            transitionToCrabFight();
        }
    }

    // --- Crab Fight Logic ---
    function updateCFBackground() {
        // Simplified scroll - adjust speed as needed
        cf_backgroundX -= 1 * (cf_crabBoss.state === 'walking' ? 1 : 0.5); // Slower if crab not walking
        if (cf_backgroundX <= -canvas.width) {
             cf_backgroundX += canvas.width;
        }
    }

    function updateCFEric() {
         // State Transitions
        if (cf_ericState === 'crunching') {
            cf_ericActionTimer++;
            if (cf_ericActionTimer > CF_CRUNCH_ANIMATION_DURATION) {
                cf_ericState = 'walking';
                cf_ericActionTimer = 0;
            }
        }

        // Animation (Simple walk cycle based on timer)
        if (cf_ericState === 'walking') {
            cf_ericAnimTimer++;
            if (cf_ericAnimTimer > 10) { // Adjust walk cycle speed
                cf_ericFrameX = (cf_ericFrameX + 1) % 8; // Assuming 8 walk frames
                cf_ericAnimTimer = 0;
            }
        }
    }

    function updateCFCrab() {
        const crab = cf_crabBoss; // Alias for readability
        const speedMultiplier = 1.5; // Make crab move faster in this mode

        switch (crab.state) {
            case 'walking':
                crab.x -= CF_CRAB_SPEED * speedMultiplier;
                // Animation
                crab.animTimer++;
                if (crab.animTimer > 8) { // Crab walk speed
                    crab.frameX = (crab.frameX + 1) % 5; // 5 walk frames
                    crab.animTimer = 0;
                }
                // Reset position if it goes off screen left (looping attack)
                if (crab.x + crab.width < 0) {
                    crab.x = canvas.width; // Reset to right side
                    crab.frameX = 0;
                    // Maybe add slight delay or speed variation here?
                }
                break;

            case 'crunched': // Stunned after being hit
                crab.actionTimer++;
                if (crab.actionTimer > CF_CRAB_HIT_STUN_DURATION) {
                    crab.state = 'walking';
                    crab.actionTimer = 0;
                }
                // Optionally, slight knockback visual?
                // crab.x += 1;
                break;

            case 'dying':
                crab.deathTimer++;
                 const deathFrameDelay = Math.max(1, Math.floor(CF_CRAB_DEATH_ANIMATION_DURATION / 3)); // 3 death frames
                 crab.frameX = Math.min(2, Math.floor(crab.deathTimer / deathFrameDelay));
                 // Check if death animation finished
                 if (crab.deathTimer > CF_CRAB_DEATH_ANIMATION_DURATION) {
                     // Crab is defeated!
                     transitionToCollector(); // Transition back
                 }
                break;
        }

        // Collision Check (only when crab walking and eric crunching)
        if (crab.state === 'walking' && cf_ericState === 'crunching' &&
            cf_ericActionTimer > 1 && cf_ericActionTimer <= CF_CRUNCH_ACTIVE_FRAMES + 1)
        {
            const ericCrunchRect = {
                 x: CF_ERIC_X + CF_ERIC_CRUNCH_OFFSET_X, y: CF_ERIC_Y + CF_ERIC_CRUNCH_OFFSET_Y,
                 width: CF_ERIC_CRUNCH_WIDTH, height: CF_ERIC_CRUNCH_HEIGHT
            };
            const crabHitRect = {
                 x: crab.x + CF_CRAB_HITBOX_OFFSET_X, y: crab.y + CF_CRAB_HITBOX_OFFSET_Y,
                 width: CF_CRAB_HITBOX_WIDTH, height: CF_CRAB_HITBOX_HEIGHT
            };

            if (checkCollision(ericCrunchRect, crabHitRect)) {
                handleCrabHit(); // Process the hit
            }
        }
    }

    function handleCrabHit() {
         if (cf_crabBoss.state !== 'walking') return; // Can only hit walking crab

         playSound('cfHit', 0.9); // Play the "fuck crab" sound
         triggerScreenShake(10, 3); // Small hit shake
         cf_crabBoss.hitCount++;
         cf_crabBoss.state = 'crunched'; // Put crab in hit stun
         cf_crabBoss.actionTimer = 0;
         cf_crabBoss.frameX = 0; // Use frame 0 of walk? Or specific hit frame if available? Using crunch frame.

         // Check if this hit defeats the crab
         if (cf_crabBoss.hitCount >= CRAB_BOSS_HITS_NEEDED) {
             console.log("Crab Defeated!");
             cf_crabBoss.state = 'dying';
             cf_crabBoss.deathTimer = 0;
             cf_crabBoss.frameX = 0; // Start death animation
             // Sound for defeat? Maybe reuse powerup sound?
             playSound('ccPowerup', 1.0);
         } else {
             // Optional: Add floating text for hit count?
         }
    }


    function updateCrabFight() {
        updateCFBackground();
        updateCFEric();
        updateCFCrab(); // Includes collision and state changes
        updateCCParticles(); // Keep updating any leftover particles
    }

    // --- Drawing Functions ---
    function drawCCStarfield() { /* ... same as drawStarfield, uses cc_starLayers ... */ ctx.fillStyle='#FFFFFF';for(let l=0;l<CC_STARFIELD_LAYERS;l++){ctx.globalAlpha=.4+(l/CC_STARFIELD_LAYERS)*.6;cc_starLayers[l].forEach(s=>{ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.fill()})}ctx.globalAlpha=1.0;}
    function drawCCPlayer() { /* ... same as drawPlayer, uses cc_player, cc_invincibilityTimer etc ... */ if(cc_playerInvincible&&Math.floor(cc_invincibilityTimer/5)%2===0)return;ctx.fillStyle=PLAYER_COLOR_BODY;ctx.beginPath();ctx.moveTo(cc_player.x+cc_player.width/2,cc_player.y);ctx.lineTo(cc_player.x,cc_player.y+cc_player.height*.8);ctx.lineTo(cc_player.x+cc_player.width*.2,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width*.8,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width,cc_player.y+cc_player.height*.8);ctx.closePath();ctx.fill();ctx.fillStyle=PLAYER_COLOR_WINDOW;ctx.fillRect(cc_player.x+cc_player.width*.3,cc_player.y+cc_player.height*.2,cc_player.width*.4,cc_player.height*.3);const s=Math.abs(cc_player.vx)/CC_PLAYER_MAX_VX;const b=cc_player.height*(.2+s*.8);const f=b*(.7+Math.random()*.6);const h=Math.max(5,f);const w=cc_player.width*(.2+s*.3+Math.random()*.1);const o=(cc_player.width-w)/2;ctx.fillStyle=PLAYER_COLOR_FLAME2;ctx.beginPath();ctx.moveTo(cc_player.x+o,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width-o,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width/2,cc_player.y+cc_player.height+h);ctx.closePath();ctx.fill();ctx.fillStyle=PLAYER_COLOR_FLAME1;ctx.beginPath();ctx.moveTo(cc_player.x+o+2,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width-o-2,cc_player.y+cc_player.height);ctx.lineTo(cc_player.x+cc_player.width/2,cc_player.y+cc_player.height+h*.6);ctx.closePath();ctx.fill();}
    function drawCCItems() { /* ... same as drawItems, uses cc_items ... */
        cc_items.forEach(item=>{if(item.type==='star'){const size=item.size*item.pulseValue;const alpha=.7+(item.pulseValue-.5)*.6;ctx.fillStyle=CC_STAR_COLOR;ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(item.x+size/2,item.y);ctx.lineTo(item.x+size*.65,item.y+size*.35);ctx.lineTo(item.x+size,item.y+size/2);ctx.lineTo(item.x+size*.65,item.y+size*.65);ctx.lineTo(item.x+size/2,item.y+size);ctx.lineTo(item.x+size*.35,item.y+size*.65);ctx.lineTo(item.x,item.y+size/2);ctx.lineTo(item.x+size*.35,item.y+size*.35);ctx.closePath();ctx.fill();ctx.globalAlpha=1.0;}
        else if(item.type==='asteroid'){ctx.save();ctx.translate(item.x+item.size/2,item.y+item.size/2);ctx.rotate(item.rotation);ctx.fillStyle=CC_ASTEROID_COLOR_MAIN;ctx.fillRect(-item.size/2,-item.size/2,item.size,item.size);ctx.fillStyle=CC_ASTEROID_COLOR_DETAIL;ctx.fillRect(-item.size*.3,-item.size*.3,item.size*.3,item.size*.3);ctx.fillRect(item.size*.1,0,item.size*.2,item.size*.2);ctx.restore();}
        else if(item.type==='powerup'){ctx.fillStyle=item.color;ctx.beginPath();ctx.arc(item.x+item.size/2,item.y+item.size/2,item.size/2,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';const f=item.size*.55;ctx.font=`bold ${f}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';const t=(item.powerUpType==='shield')?'S':'x2';ctx.fillText(t,item.x+item.size/2,item.y+item.size/2+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';}});
    }
    function drawCCParticles() { /* ... same as drawParticles, uses cc_particles ... */ cc_particles.forEach(p=>{ctx.fillStyle=p.color;ctx.globalAlpha=Math.max(0,p.lifespan/(CC_PARTICLE_LIFESPAN*.8));ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1.0;}
    function drawCCUI() { /* ... same as drawUI, uses cc_score, cc_lives etc ... */ ctx.fillStyle='#FFFFFF';ctx.font='24px Consolas,"Courier New",monospace';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(`Score: ${cc_score}`,15,30);let livesX=canvas.width-15;ctx.textAlign='right';ctx.fillStyle='#FF6347';for(let i=0;i<cc_lives;i++){ctx.fillText('\u2665',livesX,30);livesX-=30}ctx.textAlign='left';if(cc_multiplierTimer>0){const p=Math.abs(Math.sin(frameCount*.1));ctx.fillStyle=CC_POWERUP_MULTI_COLOR;ctx.font=`bold ${26+p*4}px Consolas,"Courier New",monospace`;ctx.globalAlpha=.8+p*.2;ctx.textAlign='center';ctx.fillText(`x2 SCORE!`,canvas.width/2,30);ctx.globalAlpha=1.0;ctx.textAlign='left'}if(cc_playerInvincible&&cc_invincibilityTimer>0){ctx.strokeStyle=CC_POWERUP_SHIELD_COLOR;ctx.lineWidth=3;ctx.globalAlpha=.4+Math.abs(Math.sin(frameCount*.15))*.5;ctx.beginPath();ctx.moveTo(cc_player.x+cc_player.width/2,cc_player.y-2);ctx.lineTo(cc_player.x-2,cc_player.y+cc_player.height*.8);ctx.lineTo(cc_player.x+cc_player.width*.2-2,cc_player.y+cc_player.height+2);ctx.lineTo(cc_player.x+cc_player.width*.8+2,cc_player.y+cc_player.height+2);ctx.lineTo(cc_player.x+cc_player.width+2,cc_player.y+cc_player.height*.8);ctx.closePath();ctx.stroke();ctx.globalAlpha=1.0}ctx.textBaseline='alphabetic';}

    function drawCollector() {
        drawCCStarfield();
        drawCCParticles();
        drawCCItems();
        drawCCPlayer();
        drawCCUI();
    }

    // --- Crab Fight Drawing ---
    function drawCFBackground() {
        // Draw ocean and clouds, looping
        const ocean = assets.images.cfOceanBg;
        const clouds = assets.images.cfCloudBg;
        if (clouds) {
            ctx.drawImage(clouds, cf_backgroundX * 0.5, 0, canvas.width, canvas.height); // Slower clouds
            ctx.drawImage(clouds, cf_backgroundX * 0.5 + canvas.width, 0, canvas.width, canvas.height);
        }
        if (ocean) {
            ctx.drawImage(ocean, cf_backgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(ocean, cf_backgroundX + canvas.width, 0, canvas.width, canvas.height);
        }
         // Draw a simple ground line for reference
         ctx.fillStyle = '#d2b48c'; // Tan color
         ctx.fillRect(0, CF_GROUND_Y, canvas.width, canvas.height - CF_GROUND_Y);
    }

    function drawCFEric() {
        let img = null;
        if (cf_ericState === 'crunching') {
            img = assets.images.cfEricCrunch;
        } else { // walking
             const frameKey = `cfEricRun${cf_ericFrameX + 1}`; // Frames are 1-8
             img = assets.images[frameKey];
        }

        if (img) {
             // Draw Eric flipped? Original Shark game didn't flip Eric. Let's keep him facing right.
             ctx.drawImage(img, CF_ERIC_X, CF_ERIC_Y, CF_ERIC_WIDTH, CF_ERIC_HEIGHT);

             // Debug hitbox
            // if(cf_ericState === 'crunching'){
            //     ctx.strokeStyle='blue'; ctx.lineWidth=2;
            //     ctx.strokeRect(CF_ERIC_X + CF_ERIC_CRUNCH_OFFSET_X, CF_ERIC_Y + CF_ERIC_CRUNCH_OFFSET_Y, CF_ERIC_CRUNCH_WIDTH, CF_ERIC_CRUNCH_HEIGHT);
            // }
        } else {
            // Draw placeholder if image missing
            ctx.fillStyle = 'green'; ctx.fillRect(CF_ERIC_X, CF_ERIC_Y, 80, 150);
        }
    }

    function drawCFCrab() {
        const crab = cf_crabBoss;
        let img = null;
        let frame = crab.frameX;

        switch(crab.state) {
            case 'walking': img = assets.images[`cfCrabWalk${frame + 1}`]; break; // 1-5
            case 'crunched': img = assets.images.cfCrabCrunch; break; // Specific crunch frame
            case 'dying': img = assets.images[`cfCrabDead${frame + 1}`]; break; // 1-3
        }

        if (img) {
            ctx.drawImage(img, crab.x, crab.y, crab.width, crab.height);
             // Debug hitbox
            // ctx.strokeStyle='yellow'; ctx.lineWidth=1;
            // ctx.strokeRect(crab.x + CF_CRAB_HITBOX_OFFSET_X, crab.y + CF_CRAB_HITBOX_OFFSET_Y, CF_CRAB_HITBOX_WIDTH, CF_CRAB_HITBOX_HEIGHT);
        } else {
            ctx.fillStyle = 'red'; ctx.fillRect(crab.x, crab.y, 100, 60); // Placeholder
        }
    }

    function drawCFUI() {
        // Display crab hits remaining
        ctx.fillStyle = '#FFFF00'; // Yellow text
        ctx.font = 'bold 28px Consolas, "Courier New", monospace';
        ctx.textAlign = 'center';
        const hitsLeft = Math.max(0, CRAB_BOSS_HITS_NEEDED - cf_crabBoss.hitCount);
        ctx.fillText(`CRAB HITS LEFT: ${hitsLeft}`, canvas.width / 2, 40);
         ctx.textAlign = 'left'; // Reset

         // Maybe also show overall score?
         ctx.fillStyle = 'white';
         ctx.font = '20px Consolas, "Courier New", monospace';
         ctx.fillText(`Total Score: ${globalScore}`, 15, 30);
    }

    function drawCrabFight() {
        drawCFBackground();
        drawCCParticles(); // Draw any lingering particles
        drawCFEric();
        drawCFCrab();
        drawCFUI();
    }

    // --- Game Loop ---
    function gameLoop() {
        frameCount++;

        // Handle transitions first
        if (gameState === 'CRAB_FIGHT_TRANSITION' || gameState === 'COLLECTOR_TRANSITION') {
            transitionTimer--;
            // Draw previous state faded out, new state faded in? Or just overlay.
            // Simple approach: Just wait for timer using overlay.
            if (transitionTimer <= 0) {
                if (gameState === 'CRAB_FIGHT_TRANSITION') {
                     gameState = 'CRAB_FIGHT';
                     transitionScreen.classList.remove('visible'); // Hide overlay
                     // Optional: Start boss music
                } else { // COLLECTOR_TRANSITION
                     gameState = 'COSMIC_COLLECTOR';
                     // Already hid overlay in transition func
                }
            }
            // Draw based on what state we're going *to* during transition for background
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (gameState === 'CRAB_FIGHT_TRANSITION') drawCFBackground();
            else drawCCStarfield();
            // Keep loop running
            requestAnimationFrame(gameLoop);
            return;
        }

        // Main state machine
        switch (gameState) {
            case 'START_SCREEN':
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                if (cc_starLayers.length > 0) drawCCStarfield(); // Show stars on start
                // Input handled by global listener
                break;

            case 'COSMIC_COLLECTOR':
                updateCollector();
                // Drawing section (after potential shake)
                ctx.save();
                 let shakeX=0,shakeY=0; if(cc_screenShake.duration>0){shakeX=(Math.random()-.5)*2*cc_screenShake.magnitude;shakeY=(Math.random()-.5)*2*cc_screenShake.magnitude;ctx.translate(shakeX,shakeY);cc_screenShake.duration--;if(cc_screenShake.duration<=0)cc_screenShake.magnitude=0;}
                 ctx.fillStyle='#000';ctx.fillRect(-shakeX,-shakeY,canvas.width+Math.abs(shakeX*2),canvas.height+Math.abs(shakeY*2)); // Clear
                 drawCollector();
                ctx.restore();
                break;

            case 'CRAB_FIGHT':
                updateCrabFight();
                 // Drawing section (after potential shake)
                 ctx.save();
                 // Re-use cc_screenShake for simplicity
                 let shakeX2=0,shakeY2=0; if(cc_screenShake.duration>0){shakeX2=(Math.random()-.5)*2*cc_screenShake.magnitude;shakeY2=(Math.random()-.5)*2*cc_screenShake.magnitude;ctx.translate(shakeX2,shakeY2);cc_screenShake.duration--;if(cc_screenShake.duration<=0)cc_screenShake.magnitude=0;}
                 ctx.fillStyle='#87CEEB'; ctx.fillRect(-shakeX2,-shakeY2,canvas.width+Math.abs(shakeX2*2),canvas.height+Math.abs(shakeY2*2)); // Clear with sky blue?
                 drawCrabFight();
                 ctx.restore();
                break;

            case 'GAME_OVER':
                // Draw final frozen frame? Or just rely on overlay?
                 ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                 if (cc_starLayers.length > 0) drawCCStarfield(); // Show stars
                 // Maybe draw player ghost?
                break;
        }

        // Keep loop running unless explicitly stopped
        if (gameState !== 'STOPPED') { // Add a stopped state if needed
             requestAnimationFrame(gameLoop);
        }
    }

    // --- Initialization ---
    function initGame() {
        console.log("Initializing game state...");
        globalScore = 0; // Reset global score on full restart

        // Reset CC state
        cc_score = 0; cc_lives = CC_MAX_LIVES;
        cc_player.x = canvas.width / 2 - CC_PLAYER_WIDTH / 2; cc_player.vx = 0; cc_player.ax = 0;
        cc_items = []; cc_particles = [];
        cc_spawnRate = CC_INITIAL_SPAWN_RATE; cc_itemSpeed = CC_INITIAL_ITEM_SPEED;
        cc_playerInvincible = false; cc_invincibilityTimer = 0;
        cc_scoreMultiplier = 1; cc_multiplierTimer = 0;
        cc_screenShake = { duration: 0, magnitude: 0 };

        // Reset CF state
        cf_ericState = 'walking'; cf_ericFrameX = 0; cf_ericAnimTimer = 0; cf_ericActionTimer = 0;
        cf_crabBoss.x = canvas.width; cf_crabBoss.state = 'walking'; cf_crabBoss.hitCount = 0; cf_crabBoss.frameX = 0; cf_crabBoss.actionTimer = 0; cf_crabBoss.deathTimer = 0;

        frameCount = 0; transitionTimer = 0;
        keys.ArrowLeft = false; keys.ArrowRight = false; keys.ArrowDown = false;

        if (cc_starLayers.length === 0) createCCStarfield();

        // Ensure overlays are correct
        startScreen.classList.remove('visible');
        gameOverScreen.classList.remove('visible');
        transitionScreen.classList.remove('visible');

        // Set initial game state and start
        gameState = 'COSMIC_COLLECTOR'; // Start directly in collector mode
        isGameStarted = true; // Set flag

        // Add specific game listeners (keydown added initially)
        window.addEventListener('keyup', handleKeyUp);

        // Stop any previous music and start collector music
        if (assets.audio.cfBossMusic?.audio) assets.audio.cfBossMusic.audio.pause();
        playSound('ccMusic', 0.4);

        console.log("Starting main game loop in Collector mode...");
        requestAnimationFrame(gameLoop);
    }

     // Input Handlers
     function handleKeyDown(e) {
         if (gameState === 'START_SCREEN' && e.code === 'Enter') {
             // Try to enable audio context if first interaction
             if (window.AudioContext && !ctx.resumed) { // Check if context needs resuming
                 try { ctx.resume().then(() => { canPlayAudio = true; console.log("AudioContext resumed."); }); } catch(err){}
             } else { canPlayAudio = true; } // Assume enabled otherwise
             startGameplay(); // Load assets then initGame
             return;
         }
         if (gameState === 'GAME_OVER' && e.code === 'Enter') {
             initGame(); // Restart
             return;
         }

         // State-specific input
         switch(gameState) {
             case 'COSMIC_COLLECTOR':
                 if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
                 if (e.code === 'ArrowRight') keys.ArrowRight = true;
                 break;
             case 'CRAB_FIGHT':
                  if (e.code === 'ArrowDown' && cf_ericState === 'walking') { // Only crunch if walking
                       keys.ArrowDown = true;
                       cf_ericState = 'crunching';
                       cf_ericActionTimer = 0; // Start crunch timer
                  }
                 break;
             // Ignore input during transitions or game over (except Enter)
         }
     }
     function handleKeyUp(e) {
         if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
         if (e.code === 'ArrowRight') keys.ArrowRight = false;
         if (e.code === 'ArrowDown') keys.ArrowDown = false;
     }

    // --- Initial Setup ---
    function showLoadingScreen() {
         ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width, canvas.height);
         ctx.fillStyle = '#FFF'; ctx.font = '24px Consolas'; ctx.textAlign = 'center';
         ctx.fillText("Loading Assets...", canvas.width/2, canvas.height/2);
         ctx.textAlign = 'left';
    }

    async function startGameplay() {
         startScreen.classList.remove('visible'); // Hide start screen
         showLoadingScreen();
         await loadGameAssets(); // Wait for assets
         if (allAssetsLoaded) {
             initGame(); // Initialize and start game loops
         } else {
             console.error("Cannot start game due to asset loading errors.");
             // Keep showing error on canvas? (Handled in loadGameAssets)
         }
    }

    // Prepare initial view
    createCCStarfield();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); drawCCStarfield();
    startScreen.classList.add('visible'); // Show start screen initially
    window.addEventListener('keydown', handleKeyDown); // Listen for Enter to start loading/game

    console.log("Game setup complete. Waiting for user to start.");

}); // End DOMContentLoaded
