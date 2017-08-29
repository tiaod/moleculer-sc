const { MoleculerError } = require("moleculer").Errors;
const ERR_INVALID_TOKEN = "ERR_INVALID_TOKEN";
class UnAuthorizedError extends MoleculerError {
	/**
	 * Creates an instance of UnAuthorizedError.
	 *
	 * @param {String} type
	 * @param {any} data
	 *
	 * @memberOf UnAuthorizedError
	 */
	constructor(type, data) {
		super("Unauthorized", 401, type || ERR_INVALID_TOKEN, data);
	}
}

module.exports = {UnAuthorizedError}
