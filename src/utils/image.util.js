const withImageThumb = (obj, sourceKey, thumbKey, transformations) => {
    if (!obj) return obj;

    let thumbUrl = obj[sourceKey];
    if (
        obj[sourceKey] &&
        typeof obj[sourceKey] === 'string' &&
        obj[sourceKey].includes('/upload/') &&
        obj[sourceKey].includes('cloudinary.com')
    ) {
        thumbUrl = obj[sourceKey].replace('/upload/', `/upload/${transformations}/`);
    }

    const newObj = {};
    for (const key in obj) {
        newObj[key] = obj[key];
        if (key === sourceKey) {
            newObj[thumbKey] = thumbUrl;
        }
    }
    return newObj;
};

const withProfileImageThumb = (userObj) => {
    return withImageThumb(userObj, 'profile_image_url', 'profile_image_thumb', 'c_thumb,w_100,h_100,g_face');
};

const withNewsImageThumb = (newsObj) => {
    return withImageThumb(newsObj, 'image_url', 'image_thumb', 'c_thumb,w_544,h_306');
};

module.exports = { withImageThumb, withProfileImageThumb, withNewsImageThumb };
