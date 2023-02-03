/**
 * Class for cryptographic manipulations
 */
class CryptoUtils {
    static #addNewLines = (str) => {
        var finalString = '';
        while (str.length > 0) {
            finalString += str.substring(0, 64) + '\n';
            str = str.substring(64);
        }

        return finalString;
    }

    static #removeLines = (str) => {
        return str.replace("\n", "");
    }

    static #toPrivatePem = (privateKey) => {
        var b64 = this.#addNewLines(arrayBufferToBase64(privateKey));
        var pem = "-----BEGIN PRIVATE KEY-----\n" + b64 + "-----END PRIVATE KEY-----";
        return pem;
    }

    static #toPublicPem = (publicKey) => {
        var b64 = this.#addNewLines(arrayBufferToBase64(publicKey));
        var pem = "-----BEGIN PUBLIC KEY-----\n" + b64 + "-----END PUBLIC KEY-----";
        return pem;
    }

    /**
     * @param {String} pemPublicKey
     * @returns {Promise<CryptoKey>}
     */
    static toPublicCryptoKey = (pemPublicKey) => {
        return window.crypto.subtle.importKey(
            "spki",
            this.#publicPemToArrayBuffer(pemPublicKey),
            {
                name: "RSA-PSS",
                hash: "SHA-256"
            },
            true,
            ["verify"]
        ).catch((err) => {
            console.error(err);
            return null;
        });
    }

    static #publicPemToArrayBuffer = (pem) => {
        var b64Lines = this.#removeLines(pem);
        var b64Prefix = b64Lines.replace('-----BEGIN PUBLIC KEY-----', '');
        var b64Final = b64Prefix.replace('-----END PUBLIC KEY-----', '');
        return this.#base64ToArrayBuffer(b64Final);
    }

    static #base64ToArrayBuffer = (b64) => {
        var byteString = window.atob(b64);
        var byteArray = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }
        return byteArray;
    }

    static #privatePemToArrayBuffer = (pem) => {
        var b64Lines = this.#removeLines(pem);
        var b64Prefix = b64Lines.replace('-----BEGIN PRIVATE KEY-----', '');
        var b64Final = b64Prefix.replace('-----END PRIVATE KEY-----', '');
        return this.#base64ToArrayBuffer(b64Final);
    }

    /**
     * @param {String} pemPrivateKey
     * @returns {Promise<CryptoKey>}
     */
    static toPrivateCryptoKey = (pemPrivateKey) => {
        return new Promise((resolve, reject) => {
            window.crypto.subtle.importKey(
                "pkcs8",
                this.#privatePemToArrayBuffer(pemPrivateKey),
                {
                    name: "RSA-PSS",
                    hash: {name: "SHA-256"} // or SHA-512
                },
                true,
                ["sign"]
            ).then(resolve).catch(reject);
        })
    }

    static generateRSAPSSKeyPair = (keyLength) => {
        let keyPairOut = {
            publicKey: {}, privateKey: {}
        };

        // Let's generate the key pair first
        return new Promise((resolve, reject) => {
            window.crypto.subtle.generateKey({
                name: "RSA-PSS",
                modulusLength: keyLength,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            }, true, ["sign", "verify"]).then((keyPair) => {
                return window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey).then((exportedPrivateKey) => {
                    // converting exported private key to PEM format
                    keyPairOut.privateKey.pem = this.#toPrivatePem(exportedPrivateKey);
                    keyPairOut.privateKey.raw = keyPair.privateKey;
                }).catch((err) => {
                    reject(err);
                }).then(() => {
                    return window.crypto.subtle.exportKey("spki", keyPair.publicKey);
                }).catch((err) => {
                    reject(err);
                }).then((exportedPublicKey) => {
                    keyPairOut.publicKey.pem = this.#toPublicPem(exportedPublicKey);
                    keyPairOut.publicKey.raw = keyPair.publicKey;
                    resolve(keyPairOut);
                });
            });
        })
    }
}
