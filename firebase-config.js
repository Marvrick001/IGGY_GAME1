// Firebase Initialization
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAq_fpg5aaHXbUhO_mScxFP2x-hJwVb064",
  authDomain: "iggy-mini-app.firebaseapp.com",
  projectId: "iggy-mini-app",
  storageBucket: "iggy-mini-app.firebasestorage.app",
  messagingSenderId: "112893518955",
  appId: "1:112893518955:web:9efcb839ae315ed981bd2e",
  measurementId: "G-N9EQX099LS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save player data to Firebase
export async function savePlayerToFirebase(userId, playerData) {
  try {
    await setDoc(doc(db, "players", userId), {
      username: playerData.username,
      points: playerData.balance,
      level: playerData.level,
      lastUpdated: new Date().toISOString()
    });
    console.log("✅ Player data saved to Firebase:", userId);
  } catch (error) {
    console.error("❌ Error saving player to Firebase:", error);
  }
}

// Get top players by points
export async function getTopPlayersByPoints(limitNum = 50) {
  try {
    const q = query(
      collection(db, "players"),
      orderBy("points", "desc"),
      limit(limitNum)
    );
    const snapshot = await getDocs(q);
    const players = [];
    snapshot.forEach((doc) => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log("✅ Fetched top players by points:", players.length);
    return players;
  } catch (error) {
    console.error("❌ Error fetching players by points:", error);
    return [];
  }
}

// Get top players by level
export async function getTopPlayersByLevel(limitNum = 50) {
  try {
    const q = query(
      collection(db, "players"),
      orderBy("level", "desc"),
      limit(limitNum)
    );
    const snapshot = await getDocs(q);
    const players = [];
    snapshot.forEach((doc) => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log("✅ Fetched top players by level:", players.length);
    return players;
  } catch (error) {
    console.error("❌ Error fetching players by level:", error);
    return [];
  }
}

// Get player rank by points
export async function getPlayerRankByPoints(userId, limitNum = 500) {
  try {
    const q = query(
      collection(db, "players"),
      orderBy("points", "desc"),
      limit(limitNum)
    );
    const snapshot = await getDocs(q);
    let rank = 0;
    snapshot.forEach((doc, index) => {
      if (doc.id === userId) {
        rank = index + 1;
      }
    });
    return rank;
  } catch (error) {
    console.error("❌ Error getting player rank:", error);
    return 0;
  }
}
