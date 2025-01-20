import { WorkerEntrypoint } from 'cloudflare:workers';

function readVar(obj, path) {
	try {
		return path.split('.').reduce((acc, part) => {
			if (part.includes('[')) {
				const [key, index] = part.split(/[\[\]]/).filter(Boolean);
				return acc[key][parseInt(index, 10)];
			}
			return acc[part];
		}, obj);
	} catch (error) {
		return undefined;
	}
}

export class UtilsWorker extends WorkerEntrypoint {
	// Currently, entrypoints without a named handler are not supported
	async fetch() {
		return new Response(null, { status: 404 });
	}

	async generateID(length = 50) {
		let result = '';
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charactersLength = characters.length;
		let counter = 0;
		while (counter < length) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
			counter += 1;
		}
		return result;
	}

	async evaluateQuery(obj, query, originalObj = null) {
		console.log(obj, query);
		/**
			Evaluates a MongoDB-like filter query against an object.
			
			@param {Object} obj - The object to be evaluated against the filter query.
			@param {Object|Array} query - The filter query, which can be a single object or an array of queries that should all be satisfied.
			@returns {boolean} - Whether the object satisfies the query.
			@throws {Error} - If the query is invalid or contains unsupported operators.
		*/

		if (!originalObj) originalObj = obj;

		if (Array.isArray(query)) return query.every(async (subFilter) => await this.evaluateQuery(obj, subFilter, originalObj));

		if (typeof query !== 'object') return false;

		for (let key in query) {
			let value = query[key];

			// Handle dynamic value substitution
			if (typeof value === 'string' && value.startsWith('$$')) value = readVar(originalObj, value.slice(2));

			if (key === '$and') {
				if (!Array.isArray(value)) throw new Error('$and requires an array, but got ' + typeof value);
				if (!value.every(async (subFilter) => await this.evaluateQuery(obj, subFilter, originalObj))) return false;
			} else if (key === '$or') {
				if (!Array.isArray(value)) throw new Error('$or requires an array, but got ' + typeof value);
				if (!value.some(async (subFilter) => await this.evaluateQuery(obj, subFilter, originalObj))) return false;
			} else if (key === '$not') {
				if (typeof value !== 'object' || value === null) throw new Error('$not requires an object, but got ' + typeof value);
				if (await this.evaluateQuery(obj, value, originalObj)) return false;
			} else if (key.startsWith('$')) {
				switch (key) {
					case '$exists':
						if (readVar(originalObj, value) === undefined) return false;
						break;
					case '$re':
					case '$regex':
						if (!new RegExp(value).test(obj)) return false;
						break;
					case '$eq':
						if (typeof obj === 'object' && obj !== null) {
							if (JSON.stringify(obj) !== JSON.stringify(value)) return false;
						} else if (obj !== value) return false;
						break;
					case '$ne':
						if (obj === value) return false;
						break;
					case '$gt':
						if (!(obj > value)) return false;
						break;
					case '$gte':
						if (!(obj >= value)) return false;
						break;
					case '$lt':
						if (!(obj < value)) return false;
						break;
					case '$lte':
						if (!(obj <= value)) return false;
						break;
					case '$in':
						if (!Array.isArray(value)) throw new Error('$in requires an array, but got ' + typeof value);
						if (!value.includes(obj)) return false;
						break;
					case '$nin':
						if (!Array.isArray(value)) throw new Error('$nin requires an array, but got ' + typeof value);
						if (value.includes(obj)) return false;
						break;
					default:
						throw new Error(`Unsupported operator: ${key}`);
				}
			} else {
				const nestedValue = key.includes('.') || key.includes('[') ? readVar(obj, key) : obj[key];

				if (typeof value === 'object' && value !== null) {
					if (!(await this.evaluateQuery(nestedValue, value, originalObj))) return false;
				} else {
					if (nestedValue !== value) return false;
				}
			}
		}

		return true;
	}
}

export default {
	// Currently, entrypoints without a named handler are not supported
	async fetch(request) {
		return new Response(null, { status: 404 });
	},
};
