const repository = require('./news.repository');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

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
        if (item.image_url && item.image_url.includes('/upload/') && item.image_url.includes('cloudinary.com')) {
            item.image_url = item.image_url.replace('/upload/', '/upload/c_thumb,w_544,h_306/');
        }
        return item;
    });

	return {
		page,
		limit,
		total_pages: Math.ceil(totalCount / limit),
		data: newsWithThumbnails
	};
};

const getNewsById = async (id) => {
    return await repository.getNewsById(id);
};

const removeNews = async (id) => await repository.deleteNews(id);

module.exports = { addNews, editNews, getNews, getNewsById, removeNews };