const repository = require('./news.repository');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

const addNews = async (data, fileBuffer) => {
	let imageUrl = null;
	if (fileBuffer) {
		imageUrl = await uploadToCloudinary(fileBuffer, 'news');
	}

	return await repository.createNews({ ...data, imageUrl });
};

const getNews = async (page, limit) => {
	const offset = (page - 1) * limit;

	const [news, totalCount] = await Promise.all([
		repository.getAllNews(limit, offset),
		repository.countAllNews()
	]);

	return {
		page,
		limit,
		total_pages: Math.ceil(totalCount / limit),
		data: news
	};
};

const removeNews = async (id) => await repository.deleteNews(id);

module.exports = { addNews, getNews, removeNews };