const upiIdRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * PayMeQR is a lightweight utility class for generating UPI payment **QR codes**.
 *
 * Designed for freelancers, solo developers, and creators who want to accept donations or payments via UPI.
 * Works in both **Node.js** (base64 or Buffer) and **Browser** (Image element) environments.
 *
 * Ideal for embedding in websites, invoices, or donation widgets.
 */
class PayMeQR {
  /**
   * Creates a new PayMeQR instance with a valid UPI ID.
   *
   * @param {Object} options - Configuration object
   * @param {string} options.upiId - Your UPI ID (e.g., `you@upi`)
   * @throws {Error} If the UPI ID is invalid or not provided
   */
  constructor({ upiId }) {
    if (!upiId || typeof upiId !== "string" || !upiIdRegex.test(upiId.trim())) {
      throw new Error("Invalid or missing UPI ID");
    }

    /**
     * @private
     * @type {Object}
     * @property {string} pa - Payee UPI ID
     * @property {string} cu - Currency (always INR)
     * @property {string} [pn] - Payee name
     * @property {string} [am] - Fixed amount
     * @property {string} [tn] - Transaction note
     */
    this.params = {
      pa: upiId.trim(),
      cu: "INR",
    };
  }

  /**
   * Sets the payee name (optional). Displayed in UPI apps.
   *
   * @param {string} name - Display name (min 2 characters)
   * @returns {PayMeQR} Current instance (for chaining)
   * @throws {Error} If the name is invalid
   */
  setPayeeName(name) {
    if (typeof name !== "string" || name.trim().length < 2) {
      throw new Error("Invalid payee name");
    }
    this.params.pn = name.trim();
    return this;
  }

  /**
   * Sets a fixed transaction amount (non-editable in most apps).
   *
   * @param {number|string} amount - The amount in INR
   * @returns {PayMeQR} Current instance (for chaining)
   * @throws {Error} If the amount is not a valid number > 0
   */
  setAmount(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      throw new Error("Invalid amount");
    }
    this.params.am = num.toFixed(2);
    return this;
  }

  /**
   * Sets a transaction note (e.g., "Support me", "Invoice #123").
   *
   * @param {string} note - Descriptive note (max 80 chars)
   * @returns {PayMeQR} Current instance (for chaining)
   * @throws {Error} If the note is too long or not a string
   */
  setNote(note) {
    if (typeof note !== "string" || note.length > 80) {
      throw new Error("Note must be a string up to 80 characters");
    }
    this.params.tn = note.trim();
    return this;
  }

  /**
   * @private
   * Generates a UPI payment URI string internally for QR encoding.
   *
   * @returns {string} UPI URI (not exposed externally)
   */
  #getLink() {
    const searchParams = new URLSearchParams();
    for (const key in this.params) {
      const value = this.params[key];
      if (value !== undefined && value !== "") {
        searchParams.append(key, value);
      }
    }
    return `upi://pay?${searchParams.toString()}`;
  }

  /**
   * Generates a QR code image for the configured UPI payment.
   *
   * - In **Node.js**: Returns a base64 PNG string
   * - In **Browser**: Returns an `HTMLImageElement`
   *
   * @returns {Promise<string|HTMLImageElement>} QR image result
   * @throws {Error} If QR generation fails or env is unsupported
   */
  async createQrCode() {
    const link = this.#getLink();

    if (typeof window !== "undefined") {
      return await this.#createBrowserQrCode(link);
    } else if (typeof require === "function") {
      return await this.#createNodeQrCode(link);
    }

    throw new Error("Unsupported environment for QR generation");
  }

  /**
   * @private
   * Generates a base64 PNG QR code in Node.js
   *
   * @param {string} link - Encoded UPI URI
   * @returns {Promise<string>} Base64-encoded PNG image
   */
  async #createNodeQrCode(link) {
    try {
      const QRCode = require("qrcode");
      return await QRCode.toDataURL(link);
    } catch (error) {
      throw new Error("Failed to generate QR code: " + error.message);
    }
  }

  /**
   * @private
   * Dynamically loads the QRCode library from CDN if it's not already available.
   *
   * Ensures that the global `QRCode` object is available for use. If the script
   * is already present but still loading, it will wait. If the script is missing,
   * it injects it into the page and waits for it to load.
   *
   * @returns {Promise<void>} Resolves when QRCode library is ready.
   */
  async #loadQrCodeLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof QRCode !== "undefined") {
        return resolve(); // Already loaded
      }

      const existingScript = document.querySelector(
        'script[src*="qrcode.min.js"]'
      );

      if (existingScript) {
        // Wait for existing script to finish loading
        existingScript.addEventListener("load", resolve);
        existingScript.addEventListener("error", () =>
          reject(new Error("QRCode library failed to load."))
        );
        return;
      }

      // Inject new script tag
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js";
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = () =>
        reject(
          new Error(
            "Failed to load QRCode library from CDN. Please check your connection."
          )
        );
      document.head.appendChild(script);
    });
  }

  /**
   * @private
   * Generates a QR code image in the browser using the global `QRCode` library.
   *
   * If the QRCode library is not already available, it will be loaded automatically.
   *
   * @param {string} link - The encoded UPI URI or any data to encode.
   * @returns {Promise<HTMLImageElement>} Promise resolving to an `<img>` element with the QR code.
   *
   * @example
   * const img = await instance.#createBrowserQrCode("upi://pay?pa=abc@upi");
   * document.body.appendChild(img);
   */
  async #createBrowserQrCode(link) {
    if (typeof QRCode === "undefined") {
      await this.#loadQrCodeLibrary();
    }

    try {
      const dataUrl = await QRCode.toDataURL(link);
      const img = new Image();
      img.src = dataUrl;
      img.alt = "UPI QR Code";
      img.loading = "lazy";
      return img;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generates a QR PNG buffer — **Node.js only**.
   *
   * Use for APIs, file writing, or sending as image buffer in servers.
   *
   * @returns {Promise<Buffer>} PNG buffer
   * @throws {Error} If used in non-Node environment or fails
   */
  async getQrCodeBuffer() {
    const link = this.#getLink();

    if (typeof require !== "function") {
      throw new Error("getQrCodeBuffer() is only available in Node.js");
    }

    try {
      const QRCode = require("qrcode");
      return await QRCode.toBuffer(link);
    } catch (error) {
      throw new Error("Failed to generate QR code buffer: " + error.message);
    }
  }
}

// ✅ Cross-platform export
if (typeof module !== "undefined" && module.exports) {
  module.exports = PayMeQR;
}
if (typeof window !== "undefined") {
  window.PayMeQR = PayMeQR;
}
