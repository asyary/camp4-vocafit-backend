const bcrypt = require('bcrypt');
const crypto = require('crypto');
const repository = require('./auth.repository');
const { sendVerificationEmail } = require('../../utils/email.util');
const { generateAccessToken, generateRefreshToken } = require('../../utils/jwt.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

const determinePricing = async (email) => {
    let monthlyPrice = 300000; // Default Non-Unesa

    if (email.endsWith('unesa.ac.id')) {
        try {
			// Don't ask where I got this API endpoint from :D
            const response = await fetch(`https://sso.unesa.ac.id/api/profil/email/${email}`);
            const resData = await response.json();
            
            if (resData && resData.length > 0) {
                const data = resData[0];
                if (data.status === "Mahasiswa") {
                    if (data.namaparentunit === "Fakultas Vokasi") {
                        monthlyPrice = 100000;
                    } else {
                        monthlyPrice = 150000;
                    }
                } else if (data.status !== null) {
                    monthlyPrice = 200000;
                }
            }
        } catch (error) {
            console.error('Failed to fetch Unesa API, falling back to default', error);
        }
    }
    return monthlyPrice;
};

const register = async (data, fileBuffer) => {
    const existingUser = await repository.findByEmail(data.email);
    if (existingUser) throw new Error('Email already registered');

    // Upload image to Cloudinary
    const profileImageUrl = await uploadToCloudinary(fileBuffer, 'users');

    const monthlyPrice = await determinePricing(data.email);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await repository.createUser({
        ...data,
        passwordHash,
        monthlyPrice,
        verificationToken,
        profileImageUrl
    });

    await sendVerificationEmail(user.email, user.full_name, verificationToken);
    return user;
};

const login = async (data) => {
    const user = await repository.findByEmail(data.email);
    if (!user) throw new Error('Invalid credentials');
    if (!user.is_verified) throw new Error('Please verify your email first');

    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) throw new Error('Invalid credentials');

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    return { accessToken, refreshToken, user: { id: user.id, role: user.role, name: user.full_name } };
};

module.exports = { register, login, verifyUser: repository.verifyUserInDb };