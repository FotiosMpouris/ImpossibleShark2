console.log("Game script started - Creative Overhaul");

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) { console.error("Canvas element not found!"); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Failed to get 2D context!"); return; }

    // --- Constants ---
    const GROUND_HEIGHT = 100;
    const PLAYER_Y_OFFSET = 400;
    const ENEMY_Y_OFFSET = 400;
    const CRAB_Y_OFFSET = 300;
    const MICKEY_MAX_HITS = 6;
    const CRAB_MAX_HITS = 2;
    const PUNCH_ACTIVE_FRAMES = 15; // Punch active duration
    const CRUNCH_ACTIVE_FRAMES = 15; // Crunch active duration
    const PARRY_WINDOW = 5;        // Frames for successful crab parry
    const ACTION_DURATION_FRAMES = 28; // Total duration for punch/crunch animation (slightly faster)
    const PINCHED_DURATION_FRAMES = 45; // Longer stun when pinched
    const HIT_STAGGER_FRAMES = 25;
    const DEATH_ANIMATION_FRAMES = 60;
    const BONUS_DISPLAY_FRAMES = 50;
    const INITIAL_CRAB_SPAWN_INTERVAL = 1000; // Faster initial crab spawn
    const MIN_CRAB_SPAWN_INTERVAL = 300;     // Minimum crab spawn interval at high speed
    const GAME_SPEED_INCREASE = 0.0004;      // Faster speed increase
    const MAX_GAME_SPEED = 5;                // Cap game speed eventually
    const INSTRUCTION_DISPLAY_DURATION_MS = 10000;
    const SCREEN_SHAKE_MAGNITUDE_HIT = 2;
    const SCREEN_SHAKE_DURATION_HIT = 5;
    const SCREEN_SHAKE_MAGNITUDE_KILL = 5;
    const SCREEN_SHAKE_DURATION_KILL = 10;
    const FLOATING_SCORE_DURATION = 45; // Frames
    const MIN_ENEMY_SPAWN_GAP = 200; // Min pixels between newly spawned enemy and existing one

    // --- Game State Variables ---
    let gameSpeed = 1;
    let score = 0;
    let frameCount = 0;
    let gameStartTime = Date.now();
    let mickeyHitCount = 0;
    let scoreColor = 'white';
    let showInstructions = true;
    let crabTimer = 0;
    let showBonus = false;
    let bonusTimer = 0;
    let gameRunning = false;
    let debugMode = false; // Set to true to see hitboxes
    let screenShake = { duration: 0, magnitude: 0 };
    let floatingScores = []; // Array for displaying score popups

    // --- Utility Functions ---
    const getCrabSpawnInterval = () => Math.max(MIN_CRAB_SPAWN_INTERVAL, Math.floor(INITIAL_CRAB_SPAWN_INTERVAL / gameSpeed));

    // --- Asset Loading (using structure from previous example) ---
    const assets = { images: {}, audio: {} };
    // Assume loadImage, loadAudio, loadGameAssets, assignAssets are here (identical to previous refactor)
    // --- (Paste asset loading functions here) ---
    function loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            assets.images[key] = img;
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                reject(`Failed to load image: ${src}`);
            };
            img.src = src;
        });
    }

    function loadAudio(key, src, loop = false) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(src);
            assets.audio[key] = audio;
            audio.loop = loop;
            audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
            audio.onerror = (e) => {
                console.error(`Failed to load audio: ${src}`, e);
                resolve(audio); // Don't reject
            };
            audio.load();
        });
    }

    function loadGameAssets() {
        const imagePromises = [
            loadImage('oceanBackground', 'assets/ImpossibleLoop01.png'),
            loadImage('cloudBackground', 'assets/ImpossibleClouds01.png'),
            loadImage('ericCrunch', 'assets/ericCrunch.png'),
            loadImage('ericPinched', 'assets/ericPinched.png'),
            loadImage('mickeyHit', 'assets/MickeyHit.png'),
            loadImage('crabCrunch', 'assets/crabCrunch.png'), // This might be unused if parry kills instantly
            loadImage('bonus', 'assets/Bonus.png'),
            loadImage('ericPunch1', 'assets/ericPunch.png'),
            loadImage('ericPunch2', 'assets/ericPunch2.png'),
        ];
        for (let i = 1; i <= 8; i++) imagePromises.push(loadImage(`ericRun${i}`, `assets/EricRun${i}.png`));
        for (let i = 1; i <= 21; i++) imagePromises.push(loadImage(`mickeyWalk${i}`, `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`mickeyDie${i}`, `assets/MickeyDie${i}.png`));
        for (let i = 1; i <= 5; i++) imagePromises.push(loadImage(`crabWalk${i}`, `assets/crabWalk${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`crabDead${i}`, `assets/crabDead${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`punchEffect${i}`, `assets/PunchEffect${i}.png`));

        const audioPromises = [
            loadAudio('punch', 'assets/PunchSound.mp3'),
            loadAudio('fuckCrab', 'assets/fuckCrab.mp3'), // Might repurpose for parry
            loadAudio('ericOuch', 'assets/ericOuch.mp3'),
            loadAudio('mickeyDeath', 'assets/deathSound.mp3'),
            loadAudio('bonus', 'assets/bonusSound.mp3'),
            loadAudio('gameMusic', 'assets/GameMusic.mp3', true)
        ];
        for (let i = 1; i <= 7; i++) audioPromises.push(loadAudio(`mickeyNoise${i}`, `assets/MickeyNoise${i}.mp3`));

        return Promise.all([...imagePromises, ...audioPromises]);
    }

     function assignAssets() {
        eric.walkImages = []; for (let i = 1; i <= 8; i++) eric.walkImages.push(assets.images[`ericRun${i}`]);
        eric.punchImages = [assets.images['ericPunch1'], assets.images['ericPunch2']];
        eric.crunchImage = assets.images['ericCrunch'];
        eric.pinchedImage = assets.images['ericPinched'];

        mickey.walkImages = []; for (let i = 1; i <= 21; i++) mickey.walkImages.push(assets.images[`mickeyWalk${i}`]);
        mickey.hitImage = assets.images['mickeyHit'];
        mickey.dieImages = []; for (let i = 1; i <= 3; i++) mickey.dieImages.push(assets.images[`mickeyDie${i}`]);

        crab.walkImages = []; for (let i = 1; i <= 5; i++) crab.walkImages.push(assets.images[`crabWalk${i}`]);
        crab.crunchImage = assets.images['crabCrunch']; // Used if parry fails but still hits
        crab.dieImages = []; for (let i = 1; i <= 3; i++) crab.dieImages.push(assets.images[`crabDead${i}`]);

        punchEffectImages = []; for (let i = 1; i <= 3; i++) punchEffectImages.push(assets.images[`punchEffect${i}`]);

        assets.audio.mickeyNoises = []; for (let i = 1; i <= 7; i++) assets.audio.mickeyNoises.push(assets.audio[`mickeyNoise${i}`]);
        assets.audio.currentMickeyNoiseIndex = 0;
    }
    // --- End Asset Loading ---


    // --- Background ---
    let oceanBackgroundX = 0;
    let cloudBackgroundX = 0;

    // --- Eric (Player) ---
    const eric = {
        x: canvas.width / 2 - 450, // Start Eric more centered conceptually
        y: canvas.height - GROUND_HEIGHT - PLAYER_Y_OFFSET,
        width: 900,
        height: 500,
        frameX: 0,
        animationFrame: 0,
        animationDelay: 12, // Slightly faster walk cycle
        state: 'walking', // walking, punching, crunching, pinched
        actionDuration: 0,
        facingRight: true, // NEW: Direction tracking
        // Hitboxes - Initial values, likely need tuning!
        punchHitboxWidth: 120, // Slightly wider punch
        punchHitboxOffset: 680, // Adjusted offset
        crunchHitboxWidth: 100,
        crunchHitboxOffset: 700,
        // Images
        walkImages: [], punchImages: [], crunchImage: null, pinchedImage: null,
        currentPunchImage: null
    };

    // --- Mickey (Enemy 1) ---
    const mickey = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - ENEMY_Y_OFFSET,
        width: 900, height: 500, frameX: 0,
        animationFrame: 0, animationDelay: 4, // Faster walk
        baseSpeed: 2.2, speed: 2.2, // Slightly faster base
        visible: true, state: 'walking',
        hitDuration: 0, deathFrame: 0, deathAnimationDuration: 0,
        hitboxWidth: 100, hitboxOffset: 400,
        walkImages: [], hitImage: null, dieImages: [],
        punchEffectIndex: -1, punchEffectDuration: 0,
        aggressionLevel: 0 // NEW: Visual change marker
    };

    // --- Crab (Enemy 2) ---
    const crab = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET,
        width: 1000, height: 500, frameX: 0,
        animationFrame: 0, animationDelayBase: 9,
        baseSpeed: 3.5, speed: 3.5, // Faster crab
        visible: false, state: 'walking',
        hitCount: 0, // Still used for non-parry hits
        deathFrame: 0, deathAnimationDuration: 0,
        crunchDuration: 0, // For non-parry crunch visual
        // Hitbox (relative to crab.x) - Tuned slightly
        hitboxWidth: crab.width * 0.5, // Smaller target
        hitboxOffset: crab.width * 0.25, // Centered hitbox
        walkImages: [], crunchImage: null, dieImages: []
    };

    // --- Punch Effects ---
    let punchEffectImages = []; // Populated in assignAssets

    // --- Sound Playback Helper ---
    function playSound(key, volume = 1.0) {
        const sound = assets.audio[key];
        if (sound && sound.readyState >= 3) {
            sound.currentTime = 0;
            sound.volume = volume;
            sound.play().catch(e => {}); // Ignore rapid playback errors
        }
    }

    // --- Screen Shake ---
    function triggerScreenShake(duration, magnitude) {
        if (screenShake.duration <= 0) { // Don't override existing shake if longer
            screenShake.duration = duration;
            screenShake.magnitude = magnitude;
        } else { // If already shaking, maybe add intensity?
            screenShake.duration = Math.max(screenShake.duration, duration);
            screenShake.magnitude = Math.max(screenShake.magnitude, magnitude);
        }
    }

    // --- Floating Score ---
    function addFloatingScore(text, x, y, color = 'white') {
        floatingScores.push({
            text: text,
            x: x,
            y: y,
            duration: FLOATING_SCORE_DURATION,
            alpha: 1.0,
            color: color
        });
    }

    function updateFloatingScores() {
        for (let i = floatingScores.length - 1; i >= 0; i--) {
            const fs = floatingScores[i];
            fs.duration--;
            fs.y -= 0.5; // Float upwards
            fs.alpha = Math.max(0, fs.duration / FLOATING_SCORE_DURATION);
            if (fs.duration <= 0) {
                floatingScores.splice(i, 1);
            }
        }
    }

    function drawFloatingScores() {
        ctx.font = 'bold 20px Arial';
        floatingScores.forEach(fs => {
            ctx.fillStyle = `rgba(${hexToRgb(fs.color)}, ${fs.alpha})`;
            ctx.fillText(fs.text, fs.x, fs.y);
        });
    }
    // Helper for color conversion
    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        // Hacky map common color names
        if (hex.toLowerCase() === 'white') return '255, 255, 255';
        if (hex.toLowerCase() === 'gold') return '255, 215, 0';
        if (hex.toLowerCase() === 'lightgreen') return '144, 238, 144';
        if (hex.toLowerCase() === 'red') return '255, 0, 0';
        return `${r}, ${g}, ${b}`; // Default if hex code provided
    }


    // --- Game Loop ---
    function gameLoop() {
        if (!gameRunning) return;

        // --- Pre-drawing state reset (like transform) ---
        ctx.save(); // Save default state
        // Apply screen shake
        if (screenShake.duration > 0) {
            const shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            const shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            ctx.translate(shakeX, shakeY);
            screenShake.duration--;
        }

        // --- Clearing ---
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear with potential shake offset

        // --- Updates ---
        updateBackground();
        updateEric();
        updateMickey();
        updateCrab();
        updateFloatingScores();
        updateGameSpeedAndScore();

        // --- Drawing ---
        drawBackground();
        drawCrab();
        drawMickey();
        drawEric(); // Eric drawn potentially flipped
        drawScore();
        drawFloatingScores();
        drawInstructions();
        if (showBonus) drawBonus();

        // --- Post-drawing state restore ---
        ctx.restore(); // Restore to state before shake/transforms

        requestAnimationFrame(gameLoop);
    }

    // --- Update Functions ---
    function updateGameSpeedAndScore() {
        gameSpeed = Math.min(MAX_GAME_SPEED, gameSpeed + GAME_SPEED_INCREASE);
        frameCount++;
        if (showInstructions && (Date.now() - gameStartTime > INSTRUCTION_DISPLAY_DURATION_MS)) {
            showInstructions = false;
        }
    }

    function updateBackground() {
        oceanBackgroundX -= gameSpeed * 1.0;
        if (oceanBackgroundX <= -canvas.width) oceanBackgroundX += canvas.width;
        cloudBackgroundX -= gameSpeed * 0.5;
        if (cloudBackgroundX <= -canvas.width) cloudBackgroundX += canvas.width;
    }

    function updateEric() {
        // State Transitions
        if (eric.state !== 'walking') {
            eric.actionDuration++;
            const durationLimit = (eric.state === 'pinched') ? PINCHED_DURATION_FRAMES : ACTION_DURATION_FRAMES;
            if (eric.actionDuration > durationLimit) {
                eric.state = 'walking';
                eric.actionDuration = 0;
            }
        }

        // Animation
        if (eric.state === 'walking') {
            eric.animationFrame++;
            if (eric.animationFrame >= eric.animationDelay) {
                eric.frameX = (eric.frameX + 1) % eric.walkImages.length;
                eric.animationFrame = 0;
            }
        }
        // Eric remains stationary horizontally
    }

    function updateMickey() {
        if (!mickey.visible) return;
        mickey.speed = mickey.baseSpeed * gameSpeed;

        switch (mickey.state) {
            case 'walking':
                mickey.x -= mickey.speed;
                mickey.animationFrame++;
                if (mickey.animationFrame >= mickey.animationDelay) {
                    mickey.frameX = (mickey.frameX + 1) % mickey.walkImages.length;
                    mickey.animationFrame = 0;
                }
                if (mickey.x + mickey.width < 0) {
                    respawnMickey();
                }
                break;
            case 'hit':
                mickey.hitDuration++;
                if (mickey.hitDuration <= HIT_STAGGER_FRAMES) {
                    // Dynamic stagger based on aggression?
                    mickey.x += mickey.speed * (0.4 + mickey.aggressionLevel * 0.1 + Math.random() * 0.1);
                }
                if (mickey.hitDuration > ACTION_DURATION_FRAMES) { // Recover slightly faster
                    mickey.state = 'walking';
                    mickey.hitDuration = 0;
                }
                break;
            case 'dying':
                mickey.deathAnimationDuration++;
                const deathFrameDelay = DEATH_ANIMATION_FRAMES / mickey.dieImages.length;
                mickey.deathFrame = Math.min(mickey.dieImages.length - 1, Math.floor(mickey.deathAnimationDuration / deathFrameDelay));
                if (mickey.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                    respawnMickey();
                }
                break;
        }

        if (mickey.punchEffectIndex !== -1) {
            mickey.punchEffectDuration++;
            if (mickey.punchEffectDuration > ACTION_DURATION_FRAMES / 2) {
                mickey.punchEffectIndex = -1;
                mickey.punchEffectDuration = 0;
            }
        }
        checkEricPunchCollision();
    }

    function updateCrab() {
        if (crab.visible) {
            crab.speed = crab.baseSpeed * gameSpeed;
            const currentAnimationDelay = Math.max(1, Math.floor(crab.animationDelayBase / gameSpeed));

            switch (crab.state) {
                case 'walking':
                    crab.x -= crab.speed;
                    crab.animationFrame++;
                    if (crab.animationFrame >= currentAnimationDelay) {
                        crab.frameX = (crab.frameX + 1) % crab.walkImages.length;
                        crab.animationFrame = 0;
                    }
                     // Check for passing Eric - more precise check needed for parry
                    const ericFrontEdge = eric.x + (eric.facingRight ? eric.crunchHitboxOffset : eric.width - eric.crunchHitboxOffset - eric.crunchHitboxWidth); // Where crunch happens
                    if (crab.x + crab.hitboxOffset < ericFrontEdge + 50 && // Crab's front hitbox near Eric's crunch zone
                        crab.x + crab.hitboxOffset + crab.hitboxWidth > ericFrontEdge - 50) {
                         // Crab is in the pinch zone, check if Eric is NOT crunching or pinched
                         if (eric.state !== 'crunching' && eric.state !== 'pinched') {
                             crabPassed(); // Pinch Eric
                         }
                    } else if (crab.x + crab.width < 0) { // Fully off screen left
                        crab.visible = false;
                        crabTimer = 0;
                    }
                    break;
                case 'crunched': // State after a non-parry crunch hit
                    crab.crunchDuration++;
                    if (crab.crunchDuration > ACTION_DURATION_FRAMES / 1.5) { // Shorter visual stun
                        crab.state = 'walking';
                        crab.crunchDuration = 0;
                    }
                    break;
                case 'dying':
                    crab.deathAnimationDuration++;
                    const deathFrameDelay = DEATH_ANIMATION_FRAMES / crab.dieImages.length;
                    crab.deathFrame = Math.min(crab.dieImages.length - 1, Math.floor(crab.deathAnimationDuration / deathFrameDelay));
                    if (crab.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                        crab.visible = false;
                        crab.hitCount = 0;
                        crabTimer = 0;
                    }
                    break;
            }
            checkEricCrunchCollision(); // Check collision regardless of state (for parry)
        } else {
            crabTimer++;
            if (crabTimer >= getCrabSpawnInterval()) {
                respawnCrab();
            }
        }
    }

    function crabPassed() {
        if (eric.state === 'pinched') return; // Already pinched
        crab.visible = false; // Disappears immediately
        eric.state = 'pinched';
        eric.actionDuration = 0;
        score = Math.max(0, score - 10); // Harsher penalty
        playSound('ericOuch', 1.0);
        triggerScreenShake(SCREEN_SHAKE_DURATION_HIT * 2, SCREEN_SHAKE_MAGNITUDE_HIT); // Shake when pinched
        addFloatingScore("-10", eric.x + eric.width / 2, eric.y + 50, 'red');
        crabTimer = 0;
    }

    // --- Collision Detection ---
    function checkEricPunchCollision() {
        if (mickey.visible && mickey.state === 'walking' &&
            eric.state === 'punching' &&
            eric.actionDuration > 2 && eric.actionDuration <= PUNCH_ACTIVE_FRAMES + 2) // Active frames
        {
            let punchX;
            if (eric.facingRight) {
                punchX = eric.x + eric.punchHitboxOffset;
            } else {
                // Mirrored hitbox from left edge
                punchX = eric.x + eric.width - eric.punchHitboxOffset - eric.punchHitboxWidth;
            }
            const punchHitbox = { x: punchX, y: eric.y + 150, width: eric.punchHitboxWidth, height: eric.height - 300 }; // Adjusted Y/Height
            const mickeyHitbox = { x: mickey.x + mickey.hitboxOffset, y: mickey.y, width: mickey.hitboxWidth, height: mickey.height };

            if (punchHitbox.x < mickeyHitbox.x + mickeyHitbox.width &&
                punchHitbox.x + punchHitbox.width > mickeyHitbox.x &&
                punchHitbox.y < mickeyHitbox.y + mickeyHitbox.height &&
                punchHitbox.y + punchHitbox.height > mickeyHitbox.y)
            {
                // Push back slightly further
                mickey.x = punchHitbox.x + punchHitbox.width - mickey.hitboxOffset + (eric.facingRight ? 20 : -mickey.width - 20); // Adjust push based on direction
                 hitMickey(punchHitbox.x + punchHitbox.width / 2, punchHitbox.y + punchHitbox.height / 2); // Pass hit location
            }
        }
    }

    function checkEricCrunchCollision() {
        if (crab.visible && crab.state === 'walking' && eric.state === 'crunching') {
             let crunchX;
             if (eric.facingRight) {
                 crunchX = eric.x + eric.crunchHitboxOffset;
             } else {
                 crunchX = eric.x + eric.width - eric.crunchHitboxOffset - eric.crunchHitboxWidth;
             }
             // Crunch hitbox lower to the ground
             const crunchHitbox = { x: crunchX, y: eric.y + eric.height * 0.75, width: eric.crunchHitboxWidth, height: eric.height * 0.25 };
             const crabHitbox = { x: crab.x + crab.hitboxOffset, y: crab.y, width: crab.hitboxWidth, height: crab.height * 0.6 }; // Hitbox lower half of crab

             if (crunchHitbox.x < crabHitbox.x + crabHitbox.width &&
                 crunchHitbox.x + crunchHitbox.width > crabHitbox.x &&
                 crunchHitbox.y < crabHitbox.y + crabHitbox.height &&
                 crunchHitbox.y + crunchHitbox.height > crabHitbox.y)
             {
                 // Check for PARRY window
                 const isParry = eric.actionDuration > 2 && eric.actionDuration <= PARRY_WINDOW + 2;

                 // Check if crunch is active
                 const isCrunchActive = eric.actionDuration > 2 && eric.actionDuration <= CRUNCH_ACTIVE_FRAMES + 2;

                 if (isParry) {
                     parryCrab(crunchHitbox.x + crunchHitbox.width / 2, crunchHitbox.y + crunchHitbox.height / 2);
                 } else if (isCrunchActive) {
                     // Normal crunch hit if not a parry but still in active frames
                     hitCrab(crunchHitbox.x + crunchHitbox.width / 2, crunchHitbox.y + crunchHitbox.height / 2);
                 }
             }
        }
    }

    // --- Hit Handling ---
    function hitMickey(hitX, hitY) {
        mickeyHitCount++;
        score++;
        playSound('punch', 0.8);
        triggerScreenShake(SCREEN_SHAKE_DURATION_HIT, SCREEN_SHAKE_MAGNITUDE_HIT);
        addFloatingScore("+1", hitX, hitY, 'white');

        mickey.aggressionLevel = Math.min(3, mickey.aggressionLevel + 0.5); // Increase aggression

        if (mickeyHitCount >= MICKEY_MAX_HITS) {
            mickey.state = 'dying';
            mickey.deathFrame = 0;
            mickey.deathAnimationDuration = 0;
            playSound('mickeyDeath');
            triggerScreenShake(SCREEN_SHAKE_DURATION_KILL, SCREEN_SHAKE_MAGNITUDE_KILL);
            score += 15; // More bonus points
            addFloatingScore("+15 BONUS!", hitX, hitY - 30, 'gold');
            scoreColor = 'gold';
            setTimeout(() => { scoreColor = 'white'; }, 500);
            setTimeout(() => {
                playSound('bonus');
                showBonus = true;
                bonusTimer = BONUS_DISPLAY_FRAMES;
            }, 300);
        } else {
            mickey.state = 'hit';
            mickey.hitDuration = 0;
            const noiseKey = `mickeyNoise${(assets.audio.currentMickeyNoiseIndex % assets.audio.mickeyNoises.length) + 1}`;
            playSound(noiseKey, 0.7 + mickey.aggressionLevel * 0.1); // Louder noise when more aggressive?
            assets.audio.currentMickeyNoiseIndex++;
        }
        mickey.punchEffectIndex = Math.floor(Math.random() * punchEffectImages.length);
        mickey.punchEffectDuration = 0;
    }

    function hitCrab(hitX, hitY) {
         if (crab.state !== 'walking') return; // Don't hit if already hit/dying

         crab.hitCount++;
         // Use a different sound for a normal crunch hit? Or just the parry?
         // playSound('someCrunchSound'); // If you had one
         triggerScreenShake(SCREEN_SHAKE_DURATION_HIT / 2, SCREEN_SHAKE_MAGNITUDE_HIT / 2); // Less shake

         if (crab.hitCount >= CRAB_MAX_HITS) {
             crab.state = 'dying';
             crab.deathFrame = 0;
             crab.deathAnimationDuration = 0;
             score += 5; // More points for crab kill
             addFloatingScore("+5", hitX, hitY, 'lightgreen');
             scoreColor = 'lightgreen';
             setTimeout(() => { scoreColor = 'white'; }, 500);
              // Maybe a small kill shake
             triggerScreenShake(SCREEN_SHAKE_DURATION_HIT, SCREEN_SHAKE_MAGNITUDE_HIT);
         } else {
             crab.state = 'crunched'; // Show brief visual stun
             crab.crunchDuration = 0;
             addFloatingScore("+0", hitX, hitY, '#aaa'); // Indicate hit but no score
             // Knockback
             crab.x += 30 * gameSpeed * (eric.facingRight ? 1 : -1);
         }
     }

     function parryCrab(hitX, hitY) {
         if (crab.state !== 'walking') return; // Can only parry walking crabs

         crab.state = 'dying'; // Instantly dying on parry
         crab.deathFrame = 0; // Start death anim
         crab.deathAnimationDuration = 0;

         score += 10; // Bonus points for parry
         playSound('fuckCrab', 1.0); // Loud 'fuck crab' sound for parry!
         triggerScreenShake(SCREEN_SHAKE_DURATION_KILL, SCREEN_SHAKE_MAGNITUDE_KILL * 1.2); // Big shake!
         addFloatingScore("PARRY! +10", hitX, hitY - 20, 'cyan');
         scoreColor = 'cyan'; // Flash cyan for parry
         setTimeout(() => { scoreColor = 'white'; }, 600);

         // Maybe add a visual effect like a flash?
         // (Could draw a white rect briefly)
     }

    // --- Respawn Logic ---
     function respawnMickey() {
         let newX = canvas.width + Math.random() * 100;
         // Ensure minimum gap from crab if crab is visible and near spawn area
         if (crab.visible && crab.x > canvas.width / 2) {
             newX = Math.max(newX, crab.x + crab.width + MIN_ENEMY_SPAWN_GAP);
         }
         mickey.x = newX;
         mickey.visible = true;
         mickey.state = 'walking';
         mickey.baseSpeed += 0.15; // Faster increase
         mickeyHitCount = 0;
         mickey.frameX = 0;
         mickey.deathAnimationDuration = 0; mickey.hitDuration = 0;
         mickey.punchEffectIndex = -1;
         mickey.aggressionLevel = 0; // Reset aggression
     }

     function respawnCrab() {
         let newX = canvas.width + Math.random() * 200;
         // Ensure minimum gap from mickey if mickey is visible and near spawn area
          if (mickey.visible && mickey.x > canvas.width / 2) {
             newX = Math.max(newX, mickey.x + mickey.width + MIN_ENEMY_SPAWN_GAP);
         }
         crab.x = newX;
         crab.y = canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET;
         crab.visible = true;
         crab.state = 'walking';
         crab.hitCount = 0; crab.frameX = 0;
         crab.deathAnimationDuration = 0; crab.crunchDuration = 0;
         crabTimer = 0;
         crab.baseSpeed += 0.1; // Crabs get faster too
     }

    // --- Draw Functions ---
    function drawBackground() {
        ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX + canvas.width, 0, canvas.width, canvas.height);
    }

    function drawEric() {
        ctx.save(); // Save context for potential flipping

        let currentImage = eric.walkImages[eric.frameX];
        switch (eric.state) {
            case 'punching': currentImage = eric.currentPunchImage; break;
            case 'crunching': currentImage = eric.crunchImage; break;
            case 'pinched': currentImage = eric.pinchedImage; break;
            case 'walking': default: if (!currentImage) currentImage = eric.walkImages[0]; break;
        }

        let drawX = eric.x;
        if (!eric.facingRight) {
            ctx.scale(-1, 1); // Flip horizontally
            drawX = -eric.x - eric.width; // Adjust X position for flipped drawing
        }

        if (currentImage) {
            ctx.drawImage(currentImage, drawX, eric.y, eric.width, eric.height);
        }

        // --- DEBUG: Draw Hitboxes (also flipped) ---
        if (debugMode) {
            ctx.strokeStyle = 'red'; // Punch
            ctx.lineWidth = 2;
            if (eric.state === 'punching') {
                let pX = drawX + (eric.facingRight ? eric.punchHitboxOffset : eric.width - eric.punchHitboxOffset - eric.punchHitboxWidth);
                ctx.strokeRect(pX, eric.y + 150, eric.punchHitboxWidth, eric.height - 300);
            }
            ctx.strokeStyle = 'blue'; // Crunch
            if (eric.state === 'crunching') {
                let cX = drawX + (eric.facingRight ? eric.crunchHitboxOffset : eric.width - eric.crunchHitboxOffset - eric.crunchHitboxWidth);
                ctx.strokeRect(cX, eric.y + eric.height * 0.75, eric.crunchHitboxWidth, eric.height * 0.25);
                 // Draw Parry window indicator
                 if(eric.actionDuration > 2 && eric.actionDuration <= PARRY_WINDOW + 2) {
                     ctx.strokeStyle = 'cyan';
                     ctx.strokeRect(cX - 5, eric.y + eric.height * 0.75 - 5, eric.crunchHitboxWidth + 10, eric.height * 0.25 + 10);
                 }
            }
             ctx.lineWidth = 1;
        }
        // --- END DEBUG ---

        ctx.restore(); // Restore context after drawing Eric (removes flip)
    }

     function drawMickey() {
         if (!mickey.visible) return;
         let currentImage = null;
         switch (mickey.state) {
             case 'walking': currentImage = mickey.walkImages[mickey.frameX]; break;
             case 'hit': currentImage = mickey.hitImage; break;
             case 'dying': currentImage = mickey.dieImages[mickey.deathFrame]; break;
         }

         // Aggression visual: slight red tint? (Subtle)
         if (mickey.aggressionLevel > 1 && currentImage) {
              ctx.save();
              ctx.filter = `hue-rotate(-${mickey.aggressionLevel * 5}deg) saturate(1.${mickey.aggressionLevel})`; // Reddish tint
          }

         if (currentImage) {
              ctx.drawImage(currentImage, mickey.x, mickey.y, mickey.width, mickey.height);
         }

         if (mickey.aggressionLevel > 1 && currentImage) {
             ctx.restore(); // Restore filter
         }


         if (mickey.punchEffectIndex !== -1) {
              const effectImage = punchEffectImages[mickey.punchEffectIndex];
              if (effectImage) {
                  const effectX = mickey.x + mickey.hitboxOffset + (mickey.hitboxWidth / 2) - 100;
                  const effectY = mickey.y + mickey.height / 2 - 100;
                  // Slightly scale effect based on hit?
                  const scale = 1.0 + Math.random() * 0.1;
                   ctx.drawImage(effectImage, effectX, effectY, 200 * scale, 200 * scale);
              }
         }

         if (debugMode) {
             ctx.strokeStyle = 'lime';
             ctx.strokeRect(mickey.x + mickey.hitboxOffset, mickey.y, mickey.hitboxWidth, mickey.height);
         }
     }

      function drawCrab() {
         if (!crab.visible) return;
         let currentImage = null;
         switch (crab.state) {
             case 'walking': currentImage = crab.walkImages[crab.frameX]; break;
             case 'crunched': currentImage = crab.crunchImage; break;
             case 'dying': currentImage = crab.dieImages[crab.deathFrame]; break;
         }
          if (currentImage) {
              ctx.drawImage(currentImage, crab.x, crab.y, crab.width, crab.height);
          }
          if (debugMode) {
              ctx.strokeStyle = 'yellow';
              ctx.strokeRect(crab.x + crab.hitboxOffset, crab.y, crab.hitboxWidth, crab.height * 0.6);
          }
     }

     function drawScore() { /* (Keep previous improved version) */
        const scoreText = `Score: ${score}`;
        const textWidth = ctx.measureText(scoreText).width;
        const padding = 10;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 30;
        const boxX = canvas.width - boxWidth - 15;
        const boxY = 10;
        const textX = boxX + padding;
        const textY = boxY + boxHeight / 2 + 7;

        ctx.fillStyle = 'rgba(30, 144, 255, 0.7)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        ctx.fillStyle = scoreColor;
        ctx.font = '20px Arial';
        ctx.textAlign = 'left'; // Ensure alignment is correct
        ctx.fillText(scoreText, textX, textY);
    }

    function drawInstructions() { /* (Keep previous improved version, add turn keys) */
        if (showInstructions) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(canvas.width / 2 - 250, 20, 500, 100); // Wider box

            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Punch Shark: [SPACE]', canvas.width / 2, 50);
            ctx.fillText('Crunch/Parry Crab: [DOWN]', canvas.width / 2, 75);
            ctx.fillText('Turn: [LEFT] / [RIGHT] Arrows', canvas.width / 2, 100);
            ctx.textAlign = 'left';
        }
    }

    function drawBonus() { /* (Keep previous version) */
        if (showBonus && assets.images.bonus) {
            ctx.drawImage(assets.images.bonus, canvas.width / 2 - 100, canvas.height / 2 - 100, 200, 200);
            bonusTimer--;
            if (bonusTimer <= 0) showBonus = false;
        }
    }


    // --- Event Listeners ---
    function handleKeyDown(event) {
         if (!gameRunning && assets.audio.gameMusic) { startGameMusic(); }
         if (!gameRunning) return;

         // Allow turning even when punching/crunching? Or only when walking? Let's allow always.
          if (event.code === 'ArrowLeft') {
              eric.facingRight = false;
          } else if (event.code === 'ArrowRight') {
              eric.facingRight = true;
          }

         // Only allow actions if walking
         if (eric.state === 'walking') {
             switch (event.code) {
                 case 'Space':
                     eric.state = 'punching';
                     eric.actionDuration = 0;
                     eric.currentPunchImage = eric.punchImages[Math.floor(Math.random() * eric.punchImages.length)];
                     // Play sound on hit now
                     break;
                 case 'ArrowDown':
                     eric.state = 'crunching';
                     eric.actionDuration = 0;
                     // Play sound on hit/parry
                     break;
             }
         }

         // Debug toggle
         if (event.code === 'KeyD') {
             debugMode = !debugMode;
             console.log("Debug mode:", debugMode);
         }
    }
    document.addEventListener('keydown', handleKeyDown);

     function userInteractionStart() {
         if (!gameRunning && assets.audio.gameMusic) {
             console.log("User interaction detected, attempting to start music/game.");
             startGameMusic();
         }
         // Remove listeners after first interaction
         document.removeEventListener('click', userInteractionStart);
         document.removeEventListener('keydown', userInteractionStart, {capture: true}); // Use capture to potentially catch before game keydown
     }
     document.addEventListener('click', userInteractionStart, { once: true });
     document.addEventListener('keydown', userInteractionStart, { once: true, capture: true });


    // --- Game Initialization ---
     function startGameMusic() { /* (Keep previous version) */
        const music = assets.audio.gameMusic;
        if (music && music.paused) {
            music.play().then(() => {
                console.log("Game music started successfully.");
                if (!gameRunning) startGame();
            }).catch(e => {
                console.error("Error playing game music:", e);
                 if (!gameRunning) { console.warn("Starting game without music."); startGame(); }
            });
        } else if (!gameRunning) {
             startGame();
        }
    }
     function startGame() { /* (Keep previous version) */
         if (gameRunning) return;
         console.log("Starting game loop - Creative Overhaul...");
         gameStartTime = Date.now();
         gameRunning = true;
         // Reset key variables on restart if applicable
         score = 0; gameSpeed = 1; frameCount = 0; mickey.baseSpeed = 2.2; crab.baseSpeed = 3.5;
         // Position Eric initially
         eric.x = canvas.width / 2 - eric.width / 2 + 150; // Adjust start pos slightly right
         eric.facingRight = true;
         // Ensure enemies are reset/hidden
         mickey.visible = false; setTimeout(respawnMickey, 1000); // Delay initial spawn
         crab.visible = false; crabTimer = 0; // Let crab spawn normally

         gameLoop();
     }

    // --- Load assets and then start ---
    console.log("Loading assets...");
    loadGameAssets()
        .then(() => {
            console.log("All assets loaded.");
            assignAssets();
            console.log("Assets assigned. Ready for user interaction.");
            // Display "Click or Press Key to Start" message?
             ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
             ctx.fillRect(canvas.width/2 - 150, canvas.height/2 - 30, 300, 60);
             ctx.fillStyle = 'white';
             ctx.font = 'bold 24px Arial';
             ctx.textAlign = 'center';
             ctx.fillText('Click or Press Key', canvas.width / 2, canvas.height / 2);
             ctx.fillText('to Start!', canvas.width / 2, canvas.height / 2 + 25);
             ctx.textAlign = 'left'; // Reset
        })
        .catch(error => {
            console.error("Fatal error during asset loading:", error);
             ctx.fillStyle = 'red'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
             ctx.fillText('Error loading game assets. Please refresh.', canvas.width / 2, canvas.height / 2);
        });

    console.log("Game script finished initial setup - Creative Overhaul.");
}); // End DOMContentLoaded
