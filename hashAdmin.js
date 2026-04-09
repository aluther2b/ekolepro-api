// hashAdmin.js
import bcrypt from "bcrypt";

async function hashPassword() {
  const password = "Admins123";

  try {
    const hash = await bcrypt.hash(password, 10);

    console.log("HASH:", hash);
  } catch (error) {
    console.error("Erreur:", error);
  }
}

hashPassword();