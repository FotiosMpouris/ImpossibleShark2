// Debugging: Log when the script starts
console.log("Game script started");

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let gameSpeed = 1;
const GROUND_HEIGHT = 100;
let score = 0;
let frameCount = 0;

// Background image
const backgroundImage = new Image();
backgroundImage.src = 'assets/ImpossibleLoop01.png';
let backgroundX = 0;

// Eric character
const eric = {
    x: -300,
    y: canvas.height - GROUND_HEIGHT - 400,
    width: 900,
    height: 500,
    frameX: 0,
    frameY: 0,
    speed: 9,
    walking: true,
    punching: false,
    punchDuration: 0,
    punchHitboxWidth: 100,
    punchHitboxOffset: 700
};

// Eric's walking animation
const ericImages = [];
for (let i = 1; i <= 8; i++) {
    const img = new Image();
    img.src = `assets/EricRun${i}.png`;
    ericImages.push(img);
}

// Eric's punch images
const ericPunchImage1 = new Image();
ericPunchImage1.src = 'assets/EricPunch.png';
const ericPunchImage2 = new Image();
ericPunchImage2.src = 'assets/EricPunch2.png';
let currentPunchImage = ericPunchImage1;

// Punch effect animations
const punchEffects = [];
for (let i = 1; i <= 3; i++) {
    const img = new Image();
    img.src = `assets/PunchEffect${i}.png`;
    punchEffects.push(img);
}

// Mickey characters
const mickeyPool = [];
const MAX_MICKEYS = 5;

function createMickey() {
    return {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - 400,
        width: 900,
        height: 500,
        frameX: 0,
        speed: 2,
        visible: true,
        state: 'walking',
        hitDuration: 0,
        staggerDistance: 50,
        hitboxWidth: 100,
        hitboxOffset: 400,
        punchEffectIndex: -1,
        punchEffectDuration: 0
    };
}

// Mickey's walking animation
const mickeyImages = [];
for (let i = 1; i <= 21; i++) {
    const img = new Image();
    img.src = `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`;
    mickeyImages.push(img);
}

// Mickey's hit image
const mickeyHitImage = new Image();
mickeyHitImage.src = 'assets/MickeyHit.png';

// Sounds
const punchSound = new Audio('assets/PunchSound.mp3');
const mickeyNoises = [
    new Audio('assets/MickeyNoise1.mp3'),
    new Audio('assets/MickeyNoise2.mp3'),
    new Audio('assets/MickeyNoise3.mp3'),
    new Audio('assets/MickeyNoise4.mp3'),
    new Audio('assets/MickeyNoise5.mp3'),
    new Audio('assets/MickeyNoise6.mp3'),
    new Audio('assets/MickeyNoise7.mp3')
];
let currentMickeyNoiseIndex = 0;
const curseSound = new Audio('assets/Curse.mp3');

// Error handling for audio loading
[punchSound, ...mickeyNoises, curseSound].forEach(audio => {
    audio.onerror = function() {
        console.error(`Failed to load audio: ${audio.src}`);
    };
});

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBackground();
    updateEric();
    updateMickeys();

    drawBackground();
    drawEric();
    drawMickeys();
    drawScore();

    gameSpeed += 0.0001;

    requestAnimationFrame(gameLoop);
}

// Update functions
function updateBackground() {
    backgroundX -= gameSpeed;
    if (backgroundX <= -canvas.width) {
        backgroundX = 0;
    }
}

function updateEric() {
    if (eric.walking && !eric.punching) {
        if (frameCount % 15 === 0) {
            eric.frameX = (eric.frameX + 1) % 8;
        }
    }
    if (eric.punching) {
        eric.punchDuration++;
        if (eric.punchDuration > 30) {
            eric.punching = false;
            eric.punchDuration = 0;
        }
    }
    frameCount++;
}

function updateMickeys() {
    // Spawn new Mickeys based on game speed
    if (mickeyPool.length < Math.min(MAX_MICKEYS, Math.floor(gameSpeed))) {
        mickeyPool.push(createMickey());
    }

    mickeyPool.forEach((mickey, index) => {
        if (mickey.visible) {
            switch(mickey.state) {
                case 'walking':
                    mickey.x -= mickey.speed * gameSpeed;
                    if (frameCount % 5 === 0) {
                        mickey.frameX = (mickey.frameX + 1) % 21;
                    }
                    // Check if Mickey walked past Eric
                    if (mickey.x + mickey.hitboxOffset < eric.x) {
                        curseSound.play().catch(e => console.error("Error playing curse sound:", e));
                        respawnMickey(mickey);
                    }
                    break;
                case 'hit':
                    mickey.hitDuration++;
                    if (mickey.hitDuration <= 30) {
                        mickey.x += mickey.speed * 0.5; // Stagger backwards
                    } else if (mickey.hitDuration > 60) {
                        mickey.state = 'walking';
                        mickey.hitDuration = 0;
                        mickey.punchEffectIndex = -1;
                    }
                    break;
            }

            // Check for collision with Eric's punch
            if (eric.punching && 
                eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
                mickey.state === 'walking' &&
                mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
                mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
                hitMickey(mickey);
            }

            // Update punch effect
            if (mickey.punchEffectIndex !== -1) {
                mickey.punchEffectDuration++;
                if (mickey.punchEffectDuration > 30) {
                    mickey.punchEffectIndex = -1;
                    mickey.punchEffectDuration = 0;
                }
            }
        }
    });

    // Remove off-screen Mickeys
    mickeyPool.filter(mickey => mickey.x + mickey.width < 0);
}

function hitMickey(mickey) {
    mickey.state = 'hit';
    mickey.hitDuration = 0;
    mickeyNoises[currentMickeyNoiseIndex].play().catch(e => console.error("Error playing Mickey noise:", e));
    currentMickeyNoiseIndex = (currentMickeyNoiseIndex + 1) % mickeyNoises.length;
    mickey.punchEffectIndex = Math.floor(Math.random() * 3);
    mickey.punchEffectDuration = 0;
    score++;
}

function respawnMickey(mickey) {
    mickey.x = canvas.width + Math.random() * 500; // Add some randomness to respawn position
    mickey.visible = true;
    mickey.state = 'walking';
    mickey.speed += 0.1;
}

// Draw functions
function drawBackground() {
    ctx.drawImage(backgroundImage, backgroundX, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, backgroundX + canvas.width, 0, canvas.width, canvas.height);
}

function drawEric() {
    if (eric.punching) {
        ctx.drawImage(currentPunchImage, eric.x, eric.y, eric.width, eric.height);
    } else {
        ctx.drawImage(ericImages[eric.frameX], eric.x, eric.y, eric.width, eric.height);
    }
}

function drawMickeys() {
    mickeyPool.forEach(mickey => {
        if (mickey.visible) {
            if (mickey.state === 'walking') {
                ctx.drawImage(mickeyImages[mickey.frameX], mickey.x, mickey.y, mickey.width, mickey.height);
            } else if (mickey.state === 'hit') {
                ctx.drawImage(mickeyHitImage, mickey.x, mickey.y, mickey.width, mickey.height);
            }

            // Draw punch effect
            if (mickey.punchEffectIndex !== -1) {
                ctx.drawImage(punchEffects[mickey.punchEffectIndex], 
                    mickey.x + mickey.width / 2 - 100, 
                    mickey.y + mickey.height / 2 - 100, 
                    200, 200);
            }
        }
    });
}

function drawScore() {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
}

// Event listeners
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !eric.punching) {
        eric.punching = true;
        eric.punchDuration = 0;
        currentPunchImage = Math.random() < 0.5 ? ericPunchImage1 : ericPunchImage2;
        punchSound.play().catch(e => console.error("Error playing punch sound:", e));
    }
});

// Debugging: Log when all assets are loaded
Promise.all([
    ...ericImages, 
    ericPunchImage1,
    ericPunchImage2,
    ...mickeyImages, 
    mickeyHitImage, 
    backgroundImage,
    ...punchEffects
].map(img => new Promise(resolve => {
    if (img.complete) resolve();
    else img.onload = resolve;
})))
.then(() => {
    console.log("All images loaded, starting game loop");
    gameLoop();
})
.catch(error => {
    console.error("Error loading images:", error);
});

console.log("Game script finished loading");

// // Debugging: Log when the script starts
// console.log("Game script started");

// const canvas = document.getElementById('gameCanvas');
// const ctx = canvas.getContext('2d');

// // Game variables
// let gameSpeed = 1;
// const GROUND_HEIGHT = 100;
// let score = 0;
// let frameCount = 0;

// // Background image
// const backgroundImage = new Image();
// backgroundImage.src = 'assets/ImpossibleLoop01.png';
// let backgroundX = 0;

// // Eric character
// const eric = {
//     x: -300,
//     y: canvas.height - GROUND_HEIGHT - 400,
//     width: 900,
//     height: 500,
//     frameX: 0,
//     frameY: 0,
//     speed: 9,
//     walking: true,
//     punching: false,
//     punchDuration: 0,
//     punchHitboxWidth: 100,
//     punchHitboxOffset: 700
// };

// // Eric's walking animation
// const ericImages = [];
// for (let i = 1; i <= 8; i++) {
//     const img = new Image();
//     img.src = `assets/EricRun${i}.png`;
//     ericImages.push(img);
// }

// // Eric's punch image
// const ericPunchImage = new Image();
// ericPunchImage.src = 'assets/ericPunch.png';

// // Mickey character
// const mickey = {
//     x: canvas.width,
//     y: canvas.height - GROUND_HEIGHT - 400,
//     width: 900,
//     height: 500,
//     frameX: 0,
//     speed: 2,
//     visible: true,
//     state: 'walking',
//     hitDuration: 0,
//     staggerDistance: 50,
//     hitboxWidth: 100,
//     hitboxOffset: 400
// };

// // Mickey's walking animation
// const mickeyImages = [];
// for (let i = 1; i <= 21; i++) {
//     const img = new Image();
//     img.src = `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`;
//     mickeyImages.push(img);
// }

// // Mickey's hit image
// const mickeyHitImage = new Image();
// mickeyHitImage.src = 'assets/MickeyHit.png';

// // Sounds
// const punchSound = new Audio('assets/PunchSound.mp3');
// const mickeyNoises = [
//     new Audio('assets/MickeyNoise1.mp3'),
//     new Audio('assets/MickeyNoise2.mp3'),
//     new Audio('assets/MickeyNoise3.mp3'),
//     new Audio('assets/MickeyNoise4.mp3'),
//     new Audio('assets/MickeyNoise5.mp3'),
//     new Audio('assets/MickeyNoise6.mp3'),
//     new Audio('assets/MickeyNoise7.mp3')
// ];
// let currentMickeyNoiseIndex = 0;
// const curseSound = new Audio('assets/Curse.mp3');

// // Error handling for audio loading
// [punchSound, ...mickeyNoises, curseSound].forEach(audio => {
//     audio.onerror = function() {
//         console.error(`Failed to load audio: ${audio.src}`);
//     };
// });

// // Game loop
// function gameLoop() {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     updateBackground();
//     updateEric();
//     updateMickey();

//     drawBackground();
//     drawEric();
//     drawMickey();
//     drawScore();

//     gameSpeed += 0.0001;

//     requestAnimationFrame(gameLoop);
// }

// // Update functions
// function updateBackground() {
//     backgroundX -= gameSpeed;
//     if (backgroundX <= -canvas.width) {
//         backgroundX = 0;
//     }
// }

// function updateEric() {
//     if (eric.walking && !eric.punching) {
//         if (frameCount % 15 === 0) {
//             eric.frameX = (eric.frameX + 1) % 8;
//         }
//     }
//     if (eric.punching) {
//         eric.punchDuration++;
//         if (eric.punchDuration > 30) {
//             eric.punching = false;
//             eric.punchDuration = 0;
//         }
//     }
//     frameCount++;
// }

// function updateMickey() {
//     if (mickey.visible) {
//         switch(mickey.state) {
//             case 'walking':
//                 mickey.x -= mickey.speed;
//                 if (frameCount % 5 === 0) {
//                     mickey.frameX = (mickey.frameX + 1) % 21;
//                 }
//                 // Check if Mickey walked past Eric
//                 if (mickey.x + mickey.hitboxOffset < eric.x) {
//                     curseSound.play().catch(e => console.error("Error playing curse sound:", e));
//                     respawnMickey();
//                 }
//                 break;
//             case 'hit':
//                 mickey.hitDuration++;
//                 if (mickey.hitDuration <= 30) {
//                     mickey.x += mickey.speed * 0.5; // Stagger backwards
//                 } else if (mickey.hitDuration > 60) {
//                     mickey.state = 'walking';
//                     mickey.hitDuration = 0;
//                 }
//                 break;
//         }

//         // Check for collision with Eric's punch
//         if (eric.punching && 
//             eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
//             mickey.state === 'walking' &&
//             mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
//             mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
//             hitMickey();
//         }
//     }
// }

// function hitMickey() {
//     mickey.state = 'hit';
//     mickey.hitDuration = 0;
//     mickeyNoises[currentMickeyNoiseIndex].play().catch(e => console.error("Error playing Mickey noise:", e));
//     currentMickeyNoiseIndex = (currentMickeyNoiseIndex + 1) % mickeyNoises.length;
//     score++;
// }

// function respawnMickey() {
//     mickey.x = canvas.width;
//     mickey.visible = true;
//     mickey.state = 'walking';
//     mickey.speed += 0.1;
// }

// // Draw functions
// function drawBackground() {
//     ctx.drawImage(backgroundImage, backgroundX, 0, canvas.width, canvas.height);
//     ctx.drawImage(backgroundImage, backgroundX + canvas.width, 0, canvas.width, canvas.height);
// }

// function drawEric() {
//     if (eric.punching) {
//         ctx.drawImage(ericPunchImage, eric.x, eric.y, eric.width, eric.height);
//     } else {
//         ctx.drawImage(ericImages[eric.frameX], eric.x, eric.y, eric.width, eric.height);
//     }
// }

// function drawMickey() {
//     if (mickey.visible) {
//         if (mickey.state === 'walking') {
//             ctx.drawImage(mickeyImages[mickey.frameX], mickey.x, mickey.y, mickey.width, mickey.height);
//         } else if (mickey.state === 'hit') {
//             ctx.drawImage(mickeyHitImage, mickey.x, mickey.y, mickey.width, mickey.height);
//         }
//     }
// }

// function drawScore() {
//     ctx.fillStyle = 'black';
//     ctx.font = '20px Arial';
//     ctx.fillText(`Score: ${score}`, 10, 30);
// }

// // Event listeners
// document.addEventListener('keydown', (event) => {
//     if (event.code === 'Space' && !eric.punching) {
//         eric.punching = true;
//         eric.punchDuration = 0;
//     }
// });

// // Debugging: Log when all assets are loaded
// Promise.all([
//     ...ericImages, 
//     ericPunchImage, 
//     ...mickeyImages, 
//     mickeyHitImage, 
//     backgroundImage
// ].map(img => new Promise(resolve => {
//     if (img.complete) resolve();
//     else img.onload = resolve;
// })))
// .then(() => {
//     console.log("All images loaded, starting game loop");
//     gameLoop();
// })
// .catch(error => {
//     console.error("Error loading images:", error);
// });

// console.log("Game script finished loading");
