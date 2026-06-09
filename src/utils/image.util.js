const withProfileImageThumb = (userObj) => {
    if (!userObj) return userObj;

    let profile_image_thumb = userObj.profile_image_url;
    if (
        userObj.profile_image_url &&
        userObj.profile_image_url.includes('/upload/') &&
        userObj.profile_image_url.includes('cloudinary.com')
    ) {
        profile_image_thumb = userObj.profile_image_url.replace('/upload/', '/upload/c_thumb,w_100,h_100,g_face/');
    }

    const newUser = {};
    for (const key in userObj) {
        newUser[key] = userObj[key];
        if (key === 'profile_image_url') {
            newUser.profile_image_thumb = profile_image_thumb;
        }
    }
    return newUser;
};

module.exports = { withProfileImageThumb };
