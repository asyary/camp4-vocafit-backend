const repository = require('./news.repository');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');
const { replaceWithNewsImageThumb, replaceWithAuthorImageThumb } = require('../../utils/image.util');

const truncateChars = (str, maxChars = 100) => {
    if (!str) return str;
    if (str.length <= maxChars) return str;
    return str.substring(0, maxChars) + '...';
};

const addNews = async (data, fileBuffer) => {
	let imageUrl = null;
	if (fileBuffer) {
		imageUrl = await uploadToCloudinary(fileBuffer, 'news');
	}

    const summary = truncateChars(data.content, 100);

	return await repository.createNews({ ...data, summary, imageUrl });
};

const editNews = async (id, data, fileBuffer) => {
	let imageUrl = undefined;
	if (fileBuffer) {
		imageUrl = await uploadToCloudinary(fileBuffer, 'news');
	}

    const summary = data.content ? truncateChars(data.content, 100) : undefined;

	return await repository.updateNews(id, { ...data, summary, imageUrl });
};

const getNews = async (page, limit) => {
	const offset = (page - 1) * limit;

	const [news, totalCount] = await Promise.all([
		repository.getAllNews(limit, offset),
		repository.countAllNews()
	]);
    const newsWithThumbnails = news.map(item => {
        let processed = replaceWithNewsImageThumb(item);
        processed = replaceWithAuthorImageThumb(processed);
        return processed;
    });

	return {
		page,
		limit,
		total_pages: Math.ceil(totalCount / limit),
		total_data: totalCount,
		data: newsWithThumbnails
	};
};

const getNewsById = async (id) => {
    const item = await repository.getNewsById(id);
    if (!item) return item;

    let processed = replaceWithNewsImageThumb(item);
    processed = replaceWithAuthorImageThumb(processed);

    return processed;
};

const removeNews = async (id) => await repository.deleteNews(id);

module.exports = { addNews, editNews, getNews, getNewsById, removeNews };