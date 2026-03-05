// hashAdmin.js
import bcrypt from "bcrypt";

const password = "Admins123";

const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(password, salt);

console.log("SALT:", salt);
console.log("HASH:", hash);