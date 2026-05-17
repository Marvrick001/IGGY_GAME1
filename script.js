// Telegram Web App Integration
const tg = window.Telegram.WebApp;
tg.expand();

// ========== FIREBASE REST API CONFIG ==========
const FIREBASE_PROJECT_ID = "iggy-mini-app";
const FIREBASE_API_KEY = "AIzaSyAq_fpg5aaHXbUhO_mScxFP2x-hJwVb064";
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ========== ALL VARIABLES DECLARED HERE (NO DUPLICATES) ==========

// Firebase variables
let app = null;
let db = null;
let firebaseReady = true;
let playerId = null;

// Balance & Betting
let balance = 10000;  // Initial balance
let betAmount = 0;

// Pet Logic
let petAdopted = false;
let pet = { level: 1, hunger: 100, thirst: 100, multiplier: 1.0, wealth: 0 };
let totalInvestedInPet = 0;
let playerName = "Player";
let tokenPrice = 1.0;
let miningActive = false;
let miningEarnings = 0;
let miningStartTime = 0;
let playerFlipChoice = null; // "heads" or "tails"
let playerItems = {
  designerHoodie: 0,
  goldCrown: 0,
  diamondRing: 0,
  luxuryChain: 0,
  rolex: 0,
  gWagon: 0,
  goldenLambo: 0,
  mansion: 0,
  privateJet: 0
};

// Game variables
let crashInterval, multiplier = 1.0, crashPoint;
let crashed = false;
let crashInProgress = false;

// ========== FIREBASE REST API FUNCTIONS ==========

async function uploadPlayerData() {
  try {
    if (!playerId) return;
    
    console.log("📤 Uploading player data...", { balance, level: pet.level, playerName });
    
    // Use stringValue for numbers to support unlimited growth (beyond JavaScript's Number limit)
    const playerData = {
      fields: {
        username: { stringValue: playerName },
        points: { stringValue: balance.toString() },
        level: { integerValue: pet.level.toString() },
        petAdopted: { booleanValue: petAdopted },
        lastUpdated: { timestampValue: new Date().toISOString() },
        telegramId: { stringValue: playerId },
        wealth: { stringValue: pet.wealth.toString() },
        multiplier: { doubleValue: pet.multiplier.toString() }
      }
    };
    
    const response = await fetch(
      `${FIRESTORE_URL}/players/${playerId}?key=${FIREBASE_API_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerData)
      }
    );
    
    if (response.ok) {
      console.log("✅ Player data uploaded to Firebase successfully!");
      return true;
    } else {
      console.log("❌ Firebase upload failed:", response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log("❌ Firebase upload error:", error.message);
    return false;
  }
}

async function getLeaderboard(type) {
  try {
    const response = await fetch(
      `${FIRESTORE_URL}/players?pageSize=100&key=${FIREBASE_API_KEY}`
    );
    
    if (!response.ok) throw new Error("Failed to fetch leaderboard");
    
    const data = await response.json();
    const players = [];
    
    if (data.documents) {
      data.documents.forEach(doc => {
        const fields = doc.fields;
        // Handle both stringValue and integerValue for backward compatibility
        const pointsStr = fields.points?.stringValue || fields.points?.integerValue || "0";
        players.push({
          username: fields.username?.stringValue || "Unknown",
          points: pointsStr,
          pointsNum: BigInt(pointsStr),
          level: parseInt(fields.level?.integerValue || 1),
          telegramId: fields.telegramId?.stringValue
        });
      });
    }
    
    // Sort by type using BigInt for large numbers
    if (type === "points") {
      players.sort((a, b) => b.pointsNum > a.pointsNum ? 1 : b.pointsNum < a.pointsNum ? -1 : 0);
    } else {
      players.sort((a, b) => b.level - a.level);
    }
    
    return players;
  } catch (error) {
    console.log("⚠️ Leaderboard fetch error:", error.message);
    return [];
  }
}

// ========== STORAGE FUNCTIONS ==========

function formatLargeNumber(numStr) {
  const num = BigInt(numStr);
  
  // Define suffixes for large numbers
  const suffixes = [
    { value: 1000000000000000000000000n, suffix: "Y" },  // Septillion
    { value: 1000000000000000000000n, suffix: "Z" },     // Sextillion
    { value: 1000000000000000000n, suffix: "E" },        // Quintillion
    { value: 1000000000000000n, suffix: "P" },           // Quadrillion
    { value: 1000000000000n, suffix: "T" },              // Trillion
    { value: 1000000000n, suffix: "B" },                 // Billion
    { value: 1000000n, suffix: "M" },                    // Million
    { value: 1000n, suffix: "K" }                        // Thousand
  ];
  
  for (let i = 0; i < suffixes.length; i++) {
    if (num >= suffixes[i].value) {
      const divided = Number(num * 100n / suffixes[i].value) / 100;
      return divided.toFixed(2) + suffixes[i].suffix;
    }
  }
  
  return num.toString();
}

function saveData(key, value) {
  try {
    const jsonValue = JSON.stringify(value);
    localStorage.setItem(key, jsonValue);
    console.log("✅ Saved to localStorage:", key, value);
    
    // Verify it was actually saved
    const verify = localStorage.getItem(key);
    if (verify) {
      console.log("✅ Verified saved:", key);
    } else {
      console.log("❌ Failed to save:", key);
    }
  } catch (error) {
    console.log("❌ Save error:", error);
    alert("Storage error: " + error.message);
  }
}

function loadData(key) {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      console.log("✅ Loaded from localStorage:", key, JSON.parse(data));
      return JSON.parse(data);
    }
    console.log("⚠️ No data found for:", key);
    return null;
  } catch (error) {
    console.log("❌ Load error:", error);
    return null;
  }
}

// ========== NAVIGATION ==========

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  
  // Update UI when profile page is opened
  if (id === 'profile') {
    updatePetUI();
    updateBalanceUI();
  }
}

function showTab(id) {
  document.getElementById('crash').style.display = id==='crash'?'block':'none';
  document.getElementById('flip').style.display = id==='flip'?'block':'none';
}

// ========== PET UI ==========

function updatePetUI() {
  document.getElementById("petLevel").innerText = "Level: " + pet.level;
  document.getElementById("petMultiplier").innerText = "Multiplier: " + pet.multiplier.toFixed(1) + "x";
  
  const miningSpeedDisplay = document.getElementById("miningSpeedDisplay");
  if (miningSpeedDisplay) {
    const speed = getMiningSpeed();
    miningSpeedDisplay.innerText = "⛏️ Mining Speed: " + speed.toFixed(1) + " pts/sec";
  }
  
  const miningDisplay = document.getElementById("miningDisplay");
  if (miningDisplay) {
    if (miningActive) {
      const speed = getMiningSpeed();
      miningDisplay.innerText = "⛏️ Mining: Active (+" + speed.toFixed(1) + " pts/sec)";
      miningDisplay.style.color = "#00ff64";
    } else {
      miningDisplay.innerText = "⛏️ Mining: Inactive";
      miningDisplay.style.color = "#aaa";
    }
  }
  
  const miningEarningsDisplay = document.getElementById("miningEarningsDisplay");
  if (miningEarningsDisplay) {
    miningEarningsDisplay.innerText = "Session Earnings: " + miningEarnings + " pts";
  }
  
  const petWealthDisplay = document.getElementById("petWealthDisplay");
  if (petWealthDisplay) {
    petWealthDisplay.innerText = "Pet Wealth: " + formatLargeNumber(pet.wealth.toString()) + " pts";
  }
  
  document.getElementById("hungerBar").style.width = pet.hunger + "%";
  document.getElementById("thirstBar").style.width = pet.thirst + "%";
  document.getElementById("hungerPercent").innerText = Math.round(pet.hunger) + "%";
  document.getElementById("thirstPercent").innerText = Math.round(pet.thirst) + "%";
  
  const adoptionStatus = document.getElementById("adoptionStatus");
  if (adoptionStatus) {
    adoptionStatus.innerText = petAdopted ? "✅ Adopted" : "❌ Not Adopted";
  }
  
  const profileLevel = document.getElementById("profileLevel");
  if (profileLevel) {
    profileLevel.innerText = pet.level;
  }
  const profileMultiplier = document.getElementById("profileMultiplier");
  if (profileMultiplier) {
    profileMultiplier.innerText = pet.multiplier.toFixed(1) + "x";
  }
  
  const petNetworth = (pet.level * 10000);
  const netWorthElement = document.getElementById("petNetworth");
  if (netWorthElement) {
    netWorthElement.innerText = "Pet Networth: " + formatLargeNumber(petNetworth.toString()) + " pts";
  }
  
  const totalInvestedElement = document.getElementById("profileInvested");
  if (totalInvestedElement) {
    // Calculate total price spent based on item quantities and prices
    const itemPrices = {
      designerHoodie: 1000000,
      goldCrown: 2000000,
      diamondRing: 3000000,
      luxuryChain: 5000000,
      rolex: 10000000,
      gWagon: 25000000,
      goldenLambo: 50000000,
      mansion: 100000000,
      privateJet: 500000000
    };
    
    let totalSpent = 0;
    for (let item in playerItems) {
      if (itemPrices[item]) {
        totalSpent += playerItems[item] * itemPrices[item];
      }
    }
    
    let displayText = totalSpent > 0 
      ? "Total Spent: " + formatLargeNumber(totalSpent.toString()) + " pts"
      : "No items purchased yet";
    
    totalInvestedElement.innerText = displayText;
    console.log("💰 Displaying total spent:", displayText);
  } else {
    console.log("❌ profileInvested element not found!");
  }
}

function feedPet(amount) { pet.hunger = Math.min(100, pet.hunger + amount); updatePetUI(); }
function hydratePet(amount) { pet.thirst = Math.min(100, pet.thirst + amount); updatePetUI(); }

function adoptPet() {
  if (petAdopted) {
    alert("🦎 You already adopted Iggy!");
    return;
  }
  const adoptionCost = 50000;
  if (balance < adoptionCost) {
    alert("❌ Not enough balance! Pet adoption costs " + adoptionCost.toLocaleString() + " pts. You only have " + balance.toLocaleString() + " pts");
    return;
  }
  balance -= adoptionCost;
  totalInvestedInPet += adoptionCost;
  console.log("📊 totalInvestedInPet updated to:", totalInvestedInPet);
  petAdopted = true;
  pet.wealth += adoptionCost;
  updateBalanceUI();
  updatePetUI();
  savePetData();
  alert("🦎 Welcome to Iggy! You've adopted your pet for " + adoptionCost.toLocaleString() + " pts!");
}

function upgradePet() { 
  if (!petAdopted) {
    alert("🦎 You must adopt Iggy first!");
    return;
  }
  const upgradeCost = 20000 + (pet.level * 10000);
  if (balance < upgradeCost) {
    alert("❌ Not enough balance! Upgrade costs " + upgradeCost.toLocaleString() + " pts. You only have " + balance.toLocaleString() + " pts");
    return;
  }
  balance -= upgradeCost;
  totalInvestedInPet += upgradeCost;
  pet.wealth += upgradeCost;
  pet.level++; 
  pet.multiplier = 1.0 + Math.floor(pet.level / 5) * 0.5;
  updatePetUI();
  updateBalanceUI();
  savePetData();
  uploadPlayerData();
  alert("🚀 IGGY LEVELED UP! Now level " + pet.level + " with " + pet.multiplier.toFixed(1) + "x multiplier!");
}

// ========== MINING ==========

function startMining() {
  if (!miningActive) {
    miningActive = true;
    miningStartTime = Date.now();
    miningEarnings = 0;
    updatePetUI();
    savePetData();
    alert("⛏️ Mining started! You'll earn 1 point every second, even when offline!");
  }
}

function stopMining() {
  if (miningActive) {
    const elapsedMs = Date.now() - miningStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const offlineEarnings = elapsedSeconds;
    miningEarnings += offlineEarnings;
    
    miningActive = false;
    if (miningEarnings > 0) {
      balance += miningEarnings;
      pet.wealth += miningEarnings;
      alert("⛏️ Mining stopped! You earned " + miningEarnings + " pts from mining!");
      miningEarnings = 0;
      miningStartTime = 0;
      updateBalanceUI();
    }
    savePetData();
  }
}

setInterval(() => {
  if (miningActive) {
    const miningSpeed = getMiningSpeed();
    miningEarnings += miningSpeed;
    balance += miningSpeed;
    pet.wealth += miningSpeed;
    updateBalanceUI();
    savePetData();
  }
}, 1000);

// ========== SHOP ==========

function buyFood() {
  const cost = 5000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  feedPet(30);
  updateBalanceUI();
  updatePetUI();
  savePetData();
  alert("🍖 Bought food! Iggy is happier!");
}

function buyWater() {
  const cost = 3000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  hydratePet(30);
  updateBalanceUI();
  updatePetUI();
  savePetData();
  alert("💧 Bought water! Iggy is refreshed!");
}

// ========== SHOP ITEMS ==========

function buyDesignerHoodie() {
  const cost = 1000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.designerHoodie++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("👕 You bought the Designer Hoodie! Total: " + playerItems.designerHoodie);
}

function buyGoldCrown() {
  const cost = 2000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.goldCrown++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("👑 You bought the Gold Crown! Total: " + playerItems.goldCrown);
}

function buyDiamondRing() {
  const cost = 3000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.diamondRing++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("💍 You bought the Diamond Ring! Total: " + playerItems.diamondRing);
}

function buyLuxuryChain() {
  const cost = 5000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.luxuryChain++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("⛓️ You bought the Luxury Chain! Total: " + playerItems.luxuryChain);
}

function buyRolex() {
  const cost = 10000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.rolex++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("⌚ You bought the Rolex! Total: " + playerItems.rolex);
}

function buyGWagon() {
  const cost = 25000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.gWagon++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("🚙 You bought the G Wagon! Total: " + playerItems.gWagon);
}

function buyGoldenLambo() {
  const cost = 50000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.goldenLambo++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("🟡 You bought the Golden Lambo! Total: " + playerItems.goldenLambo);
}

function buyMansion() {
  const cost = 100000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.mansion++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("🏰 You bought the Mansion! Total: " + playerItems.mansion);
}

function buyPrivateJet() {
  const cost = 500000000;
  if (balance < cost) {
    alert("Not enough balance! You need " + cost.toLocaleString() + " pts");
    return;
  }
  balance -= cost;
  totalInvestedInPet += cost;
  pet.wealth += cost;
  playerItems.privateJet++;
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  savePetData();
  uploadPlayerData();
  alert("✈️ You bought the Private Jet! Total: " + playerItems.privateJet);
}

function updatePlayerStatus() {
  const itemsList = [
    { name: "Hoodie", emoji: "👕", count: playerItems.designerHoodie },
    { name: "Crown", emoji: "👑", count: playerItems.goldCrown },
    { name: "Ring", emoji: "💍", count: playerItems.diamondRing },
    { name: "Chain", emoji: "⛓️", count: playerItems.luxuryChain },
    { name: "Rolex", emoji: "⌚", count: playerItems.rolex },
    { name: "G-Wagon", emoji: "🚙", count: playerItems.gWagon },
    { name: "Lambo", emoji: "🟡", count: playerItems.goldenLambo },
    { name: "Mansion", emoji: "🏰", count: playerItems.mansion },
    { name: "Jet", emoji: "✈️", count: playerItems.privateJet }
  ];
  
  let statusDisplay = itemsList.map(item => item.count > 0 ? item.emoji + " " + item.name + "(" + item.count + ")" : "").filter(x => x).join(" • ");
  const playerStatusEl = document.getElementById("playerStatus");
  if (playerStatusEl) {
    playerStatusEl.innerText = statusDisplay || "No items yet";
  }
}

// ========== BETTING & GAMES ==========

function setBet(amount) {
  try {
    if (amount === 'custom') {
      const custom = parseInt(prompt("Enter custom bet amount:"), 10);
      if (isNaN(custom) || custom <= 0) {
        alert("❌ Invalid amount! Must be a positive number.");
        return;
      }
      if (custom > balance) {
        alert("❌ Not enough balance! You only have " + balance.toLocaleString() + " pts");
        return;
      }
      betAmount = custom;
    } else {
      betAmount = parseInt(amount);
    }
    
    const selectedBet = document.getElementById("selectedBet");
    const selectedBetFlip = document.getElementById("selectedBetFlip");
    
    if (selectedBet) selectedBet.innerText = "Bet: " + betAmount.toLocaleString() + " pts";
    if (selectedBetFlip) selectedBetFlip.innerText = "Bet: " + betAmount.toLocaleString() + " pts";
    
    console.log("✅ Bet set to:", betAmount);
  } catch (error) {
    console.error("❌ Error setting bet:", error);
    alert("Error setting bet: " + error.message);
  }
}

// ========== CRASH GAME ==========

function startCrash() {
  try {
    if (crashInProgress) {
      alert("⚠️ A crash game is already in progress! Cashout or wait for it to end.");
      return;
    }
    if (betAmount <= 0) {
      alert("⚠️ Please select a bet amount first! Click one of the bet buttons.");
      return;
    }
    if (betAmount > balance) {
      alert("❌ Not enough balance! You only have " + balance.toLocaleString() + " pts but your bet is " + betAmount.toLocaleString() + " pts");
      return;
    }
    
    if (petAdopted && (pet.hunger === 0 || pet.thirst === 0)) {
      alert("❌ Iggy needs food and water! Buy food or water to continue playing.");
      return;
    }

    balance -= betAmount;
    updateBalanceUI();
    
    if (petAdopted) {
      pet.hunger = Math.max(0, pet.hunger - 10);
      pet.thirst = Math.max(0, pet.thirst - 15);
      updatePetUI();
      savePetData();
    }

    multiplier = 1.0;
    const crashRoll = Math.random();
    if (crashRoll < 0.3) {
      crashPoint = (Math.random() * 0.7 + 1.05).toFixed(2);  // 1.05 to 1.75 (harder - early crash)
    } else if (crashRoll < 0.6) {
      crashPoint = (Math.random() * 2.5 + 2).toFixed(2);  // 2 to 4.5 (harder - quick crash)
    } else {
      crashPoint = (Math.random() * 45 + 5).toFixed(2);  // 5 to 50 (harder - still risky)
    }
    
    crashed = false;
    crashInProgress = true;
    
    const multiplierEl = document.getElementById("multiplier");
    const crashResultEl = document.getElementById("crashResult");
    const rocketEl = document.getElementById("rocket");
    const cashoutBtn = document.querySelector("button[onclick='cashout()']");
    
    if (multiplierEl) multiplierEl.innerText = multiplier + "x";
    if (crashResultEl) crashResultEl.innerText = "";
    
    if (rocketEl) {
      rocketEl.style.left = "0px";
      rocketEl.style.bottom = "0px";
      rocketEl.style.transform = "translateX(0) translateY(0) scale(1)";
      rocketEl.style.filter = "drop-shadow(0 0 15px rgba(0, 255, 100, 0.8))";
    }
    
    if (cashoutBtn) cashoutBtn.disabled = false;

    crashInterval = setInterval(() => {
      multiplier = (parseFloat(multiplier) + 0.15).toFixed(2);
      if (multiplierEl) multiplierEl.innerText = multiplier + "x";

      const moveX = Math.min(parseFloat(multiplier) * 25, 300);
      const moveY = Math.min(parseFloat(multiplier) * 12, 150);
      const scale = Math.max(1 - (parseFloat(multiplier) - 1) * 0.02, 0.6);
      
      if (rocketEl) {
        rocketEl.style.transform = `translateX(${moveX}px) translateY(-${moveY}px) scale(${scale})`;
        
        const glowIntensity = Math.min(parseFloat(multiplier) * 2, 30);
        rocketEl.style.filter = `drop-shadow(0 0 ${glowIntensity}px rgba(0, 255, 100, 0.9))`;
      }

      if (parseFloat(multiplier) >= parseFloat(crashPoint)) {
        clearInterval(crashInterval);
        crashed = true;
        crashInProgress = false;
        if (crashResultEl) crashResultEl.innerText = "💥 Rugged at " + crashPoint + "x!";
        if (rocketEl) rocketEl.style.filter = "drop-shadow(0 0 5px rgba(255, 50, 50, 0.8))";
        if (cashoutBtn) cashoutBtn.disabled = true;
        betAmount = 0;
        document.getElementById("selectedBet").innerText = "Bet: 0 pts";
      }
    }, 150);
    
    console.log("✅ Crash game started!");
  } catch (error) {
    console.error("❌ Error in startCrash:", error);
    alert("Error starting game: " + error.message);
  }
}

function cashout() {
  try {
    if (crashed) {
      const resultEl = document.getElementById("crashResult");
      if (resultEl) resultEl.innerText = "❌ Too late! Iggy already rugged!";
      return;
    }
    clearInterval(crashInterval);
    crashInProgress = false;
    
    // Calculate winnings: only use bet amount as base
    let baseWinnings = Math.floor(betAmount * parseFloat(multiplier));
    
    // No pet multiplier - just the crash multiplier
    let winnings = baseWinnings;
    
    // Log the calculation so user can see
    console.log("💰 CRASH WINNINGS BREAKDOWN:");
    console.log("  Bet Amount:", betAmount);
    console.log("  Crash Multiplier:", multiplier + "x");
    console.log("  Total Winnings:", winnings);
    
    balance += winnings;
    pet.wealth += winnings;
    updateBalanceUI();
    savePetData();
    uploadPlayerData();
    
    const resultEl = document.getElementById("crashResult");
    const rocketEl = document.getElementById("rocket");
    const cashoutBtn = document.querySelector("button[onclick='cashout()']");
    
    if (resultEl) resultEl.innerText = "💎 Cashed out at " + multiplier + "x! Won " + winnings.toLocaleString() + " pts!";
    if (rocketEl) rocketEl.style.transform = "translateX(0) translateY(0) scale(1)";
    if (cashoutBtn) cashoutBtn.disabled = true;
    betAmount = 0;
    document.getElementById("selectedBet").innerText = "Bet: 0 pts";
    
    console.log("✅ Cashed out with winnings:", winnings);
  } catch (error) {
    console.error("❌ Error in cashout:", error);
  }
}

// ========== FLIP GAME ==========

function chooseFlipSide(side) {
  playerFlipChoice = side;
  document.getElementById("chooseHeads").style.backgroundColor = side === "heads" ? "#0f0" : "";
  document.getElementById("chooseTails").style.backgroundColor = side === "tails" ? "#0f0" : "";
}

function flipCoin() {
  try {
    if (playerFlipChoice === null) {
      alert("⚠️ Please choose heads or tails first!");
      return;
    }
    if (betAmount <= 0) {
      alert("⚠️ Please select a bet amount first! Click one of the bet buttons.");
      return;
    }
    if (betAmount > balance) {
      alert("❌ Not enough balance! You only have " + balance.toLocaleString() + " pts but your bet is " + betAmount.toLocaleString() + " pts");
      return;
    }
    
    if (petAdopted && (pet.hunger === 0 || pet.thirst === 0)) {
      alert("❌ Iggy needs food and water! Buy food or water to continue playing.");
      return;
    }

    balance -= betAmount;
    updateBalanceUI();
    
    if (petAdopted) {
      pet.hunger = Math.max(0, pet.hunger - 10);
      pet.thirst = Math.max(0, pet.thirst - 15);
      updatePetUI();
      savePetData();
    }

    const coin = document.getElementById("coin");
    const resultText = document.getElementById("flipResult");
    
    if (!coin || !resultText) {
      console.error("❌ Coin or result element not found");
      alert("Error: Game elements missing");
      return;
    }
    
    coin.style.transform = "rotateY(720deg)";
    setTimeout(() => {
      try {
        const outcome = Math.random() < 0.48 ? "heads" : "tails";
        coin.className = "coin " + outcome;
        coin.src = outcome === "heads" ? "assets/iggy-head.png" : "assets/iggy-tail.png";

        // Check if player's choice matches the outcome
        if (outcome === playerFlipChoice) {
          // Player wins!
          let baseWinnings = betAmount * 2;
          
          // Only apply pet multiplier for bonus, cap at 2x total
          let petBonus = petAdopted ? pet.multiplier : 1.0;
          petBonus = Math.min(petBonus, 2.0);
          
          let winnings = Math.floor(baseWinnings * petBonus);
          
          console.log("💰 FLIP WINNINGS BREAKDOWN:");
          console.log("  Bet Amount:", betAmount);
          console.log("  Player Choice:", playerFlipChoice);
          console.log("  Outcome:", outcome);
          console.log("  Base Winnings (2x):", baseWinnings);
          console.log("  Pet Multiplier:", petBonus.toFixed(2) + "x");
          console.log("  Total Winnings:", winnings);
          
          balance += winnings;
          pet.wealth += winnings;
          updateBalanceUI();
          savePetData();
          uploadPlayerData();
          const emoji = outcome === "heads" ? "🌕" : "🌑";
          resultText.innerText = emoji + " " + outcome.charAt(0).toUpperCase() + outcome.slice(1) + "! Correct! Won " + winnings.toLocaleString() + " pts!";
        } else {
          // Player loses
          const emoji = outcome === "heads" ? "🌕" : "🌑";
          resultText.innerText = emoji + " " + outcome.charAt(0).toUpperCase() + outcome.slice(1) + "! Wrong choice! Lost " + betAmount.toLocaleString() + " pts!";
          pet.wealth -= betAmount;
          savePetData();
          uploadPlayerData();
        }
        playerFlipChoice = null;
        document.getElementById("chooseHeads").style.backgroundColor = "";
        document.getElementById("chooseTails").style.backgroundColor = "";

        coin.style.transform = "rotateY(0deg)";
      } catch (err) {
        console.error("❌ Error in flip result:", err);
      }
    }, 600);
    
    console.log("✅ Flip game started!");
  } catch (error) {
    console.error("❌ Error in flipCoin:", error);
    alert("Error starting game: " + error.message);
  }
}

// ========== MINING SPEED MULTIPLIER (Based on Pet Level) ==========

function getMiningSpeed() {
  if (!petAdopted) return 1.0;
  // Level 1-4: 1 pt/sec
  // Level 5-10: 10 pts/sec  
  // Level 11+: 10 + (level-10) * 5
  if (pet.level <= 4) return 1.0;
  if (pet.level <= 10) return 10.0;
  return 10.0 + (pet.level - 10) * 5.0;
}

setInterval(updateMiningDisplay, 500);

function updateMiningDisplay() {
  const miningDisplay = document.getElementById("miningSpeedDisplay");
  if (miningDisplay) {
    const speed = getMiningSpeed();
    miningDisplay.innerText = "⛏️ Mining Speed: " + speed.toFixed(1) + " pts/sec";
  }
}

// Auto-save every 5 minutes
setInterval(async () => {
  if (playerName && playerName !== "Iggy Player") {
    savePetData();
    const result = await uploadPlayerData();
    if (result) {
      console.log("✅ Auto-saved leaderboard data");
    }
  }
}, 300000);

// ========== UI UPDATE FUNCTIONS ==========

function displayPlayerName() {
  const nameElement = document.getElementById("playerName");
  if (nameElement) {
    nameElement.innerText = "🤖 " + playerName;
  }
  const profileNameElement = document.getElementById("profileName");
  if (profileNameElement) {
    profileNameElement.innerText = playerName;
    console.log("✅ Profile name updated to:", playerName);
  }
}

function updateBalanceUI() {
  const balanceBox = document.getElementById("balance");
  if (balanceBox) {
    balanceBox.innerText = formatLargeNumber(balance.toString());
  }

  const profileBalance = document.getElementById("profileBalance");
  if (profileBalance) {
    profileBalance.innerText = formatLargeNumber(balance.toString()) + " pts";
  }
  
  if (!petAdopted && balance >= 500000) {
    alert("🦎 CONGRATULATIONS! You've reached 500k points!\n\n⚠️ You must now ADOPT Iggy to continue playing games and earning more!");
  }
}

// ========== DATA PERSISTENCE ==========

function loadPetData() {
  const gameState = loadData("iggyGameState_v2");
  if (gameState) {
    petAdopted = gameState.petAdopted || false;
    pet = gameState.pet || pet;
    
    // Handle both old number format and new string format for backward compatibility
    if (typeof gameState.balance === 'string') {
      balance = BigInt(gameState.balance) > BigInt(Number.MAX_SAFE_INTEGER) 
        ? gameState.balance 
        : Number(gameState.balance);
    } else {
      balance = gameState.balance || 10000;
    }
    
    totalInvestedInPet = gameState.totalInvestedInPet || 0;
    console.log("✅ Loaded totalInvestedInPet:", totalInvestedInPet);
    playerItems = gameState.playerItems || playerItems;
    miningActive = gameState.miningActive || false;
    miningEarnings = gameState.miningEarnings || 0;
    miningStartTime = gameState.miningStartTime || 0;
    
    // Calculate offline mining earnings
    if (miningActive && miningStartTime > 0) {
      const now = Date.now();
      const elapsedMs = now - miningStartTime;
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      
      if (elapsedSecs > 0) {
        const miningSpeed = getMiningSpeed();
        const offlineEarnings = elapsedSecs * miningSpeed;
        
        if (typeof balance === 'string') {
          balance = (BigInt(balance) + BigInt(offlineEarnings)).toString();
        } else {
          balance += offlineEarnings;
        }
        
        if (typeof pet.wealth === 'string') {
          pet.wealth = (BigInt(pet.wealth) + BigInt(offlineEarnings)).toString();
        } else {
          pet.wealth += offlineEarnings;
        }
        
        miningEarnings += offlineEarnings;
        miningStartTime = now;
        
        console.log("⛏️ Offline mining bonus: " + offlineEarnings.toLocaleString() + " pts (" + elapsedSecs + " seconds at " + miningSpeed + " pts/sec)");
      }
    }
  }
}

function savePetData() {
  const gameState = {
    petAdopted: petAdopted,
    pet: pet,
    totalInvestedInPet: totalInvestedInPet,
    playerItems: playerItems,
    balance: balance,
    miningActive: miningActive,
    miningEarnings: miningEarnings,
    miningStartTime: miningStartTime
  };
  saveData("iggyGameState_v2", gameState);
  console.log("💾 Game state saved with totalInvestedInPet:", totalInvestedInPet);
}

function decayStats() {
  if (petAdopted) {
    pet.hunger = Math.max(0, pet.hunger - 0.5);
    pet.thirst = Math.max(0, pet.thirst - 1);
    updatePetUI();
  }
}

function blingPassiveIncome() {
  if (petAdopted && pet.bling > 0) {
    const income = pet.bling;
    balance += income;
    pet.wealth += income;
    updateBalanceUI();
    savePetData();
  }
}

// ========== LEADERBOARD FUNCTIONS ==========

async function displayPointsLeaderboard() {
  const container = document.getElementById("pointsLeaderboard");
  if (!container) return;
  
  container.innerHTML = "<p style='text-align: center; padding: 20px; color: #aaa;'>Loading leaderboard...</p>";
  
  console.log("📊 Fetching points leaderboard...");
  const players = await getLeaderboard("points");
  console.log("📊 Players fetched:", players.length, players);
  
  let html = "<div class='lb-header'>\n    <div class='lb-rank'>Rank</div>\n    <div class='lb-name'>Player</div>\n    <div class='lb-points'>Points</div>\n  </div>";
  
  if (players.length === 0) {
    html += "<p style='text-align: center; padding: 20px; color: #aaa;'>No players on leaderboard yet. Make sure to play a game!</p>";
  } else {
    players.forEach((player, index) => {
      const isCurrentPlayer = player.telegramId === playerId ? "style='background: rgba(0,255,100,0.1);'" : "";
      const pointsDisplay = formatLargeNumber(player.points);
      html += `<div class='lb-row' ${isCurrentPlayer}><div class='lb-rank'>#${index + 1}</div><div class='lb-name'>${player.username}</div><div class='lb-points'>${pointsDisplay}</div></div>`;
    });
  }
  
  container.innerHTML = html;
}

async function displayLevelLeaderboard() {
  const container = document.getElementById("levelLeaderboard");
  if (!container) return;
  
  container.innerHTML = "<p style='text-align: center; padding: 20px; color: #aaa;'>Loading leaderboard...</p>";
  
  console.log("📊 Fetching level leaderboard...");
  const players = await getLeaderboard("level");
  console.log("📊 Players fetched:", players.length, players);
  
  let html = "<div class='lb-header'>\n    <div class='lb-rank'>Rank</div>\n    <div class='lb-name'>Player</div>\n    <div class='lb-level'>Level</div>\n  </div>";
  
  if (players.length === 0) {
    html += "<p style='text-align: center; padding: 20px; color: #aaa;'>No players on leaderboard yet. Make sure to play a game!</p>";
  } else {
    players.forEach((player, index) => {
      const isCurrentPlayer = player.telegramId === playerId ? "style='background: rgba(0,255,100,0.1);'" : "";
      html += `<div class='lb-row' ${isCurrentPlayer}><div class='lb-rank'>#${index + 1}</div><div class='lb-name'>${player.username}</div><div class='lb-level'>Lvl ${player.level}</div></div>`;
    });
  }
  
  container.innerHTML = html;
}

function showLeaderboard(type) {
  document.getElementById("points-lb").classList.remove("active");
  document.getElementById("level-lb").classList.remove("active");
  
  if (type === 'points') {
    document.getElementById("points-lb").classList.add("active");
    displayPointsLeaderboard();
  } else {
    document.getElementById("level-lb").classList.add("active");
    displayLevelLeaderboard();
  }
}

function refreshLeaderboards() {
  const activeTab = document.querySelector('.leaderboard-tabs .lb-tab.active');
  if (activeTab && activeTab.textContent.includes('Points')) {
    displayPointsLeaderboard();
  } else {
    displayLevelLeaderboard();
  }
}

function activeLBTab(el) {
  document.querySelectorAll('.leaderboard-tabs .lb-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ========== INITIALIZATION ==========

document.addEventListener("DOMContentLoaded", function() {
  // Check localStorage availability
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
    console.log("✅ localStorage is available");
  } catch (error) {
    console.log("❌ localStorage NOT available:", error);
    alert("⚠️ Warning: localStorage not available! Data may not save properly in this environment.");
  }
  
  // Clean up old localStorage keys from previous version
  console.log("🧹 Cleaning up old localStorage entries...");
  localStorage.removeItem("iggyGameState");
  localStorage.removeItem("iggyPlayerName");
  localStorage.removeItem("iggyPlayerId");
  
  loadPetData();
  
  const savedName = loadData("iggyPlayerName_v2");
  const savedPlayerId = loadData("iggyPlayerId_v2");
  
  if (savedName) {
    playerName = savedName;
  }
  if (savedPlayerId) {
    playerId = savedPlayerId;
  }
  
  if (!savedName || !savedPlayerId) {
    try {
      const tgUser = tg.initDataUnsafe?.user;
      console.log("🤖 Telegram user data:", tgUser);
      if (tgUser) {
        playerId = tgUser.id.toString();
        playerName = tgUser.username || tgUser.first_name || "Iggy Player";
        console.log("✅ Player name set to:", playerName);
        console.log("✅ Player ID set to:", playerId);
      } else {
        console.warn("⚠️ No Telegram user data available - using test player");
        playerName = "Test Player";
        playerId = "test_" + Math.random().toString(36).substr(2, 9);
      }
    } catch (error) {
      console.error("❌ Error getting Telegram user:", error);
      playerName = "Test Player";
      playerId = "test_" + Math.random().toString(36).substr(2, 9);
    }
    saveData("iggyPlayerName_v2", playerName);
    saveData("iggyPlayerId_v2", playerId);
  }
  
  console.log("📝 Current Player:", { playerId, playerName });
  
  updateBalanceUI();
  updatePetUI();
  updatePlayerStatus();
  displayPlayerName();
  
  // Upload player data immediately and then show leaderboard
  uploadPlayerData().then(() => {
    console.log("✅ Initial player data uploaded");
    setTimeout(() => displayPointsLeaderboard(), 1000);
  }).catch(() => {
    console.log("⚠️ Initial upload failed, showing local leaderboard");
    displayPointsLeaderboard();
  });
  
  setInterval(blingPassiveIncome, 3600000);
  setInterval(decayStats, 5000);
  
  console.log("✅ Game initialized successfully!");
});

// Reset for new bot deployment in Telegram
if (tg && tg.initDataUnsafe) {
  localStorage.clear();
  console.log("🧹 Telegram Mini App: Full localStorage clear for fresh start");
}
