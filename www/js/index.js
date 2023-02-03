let OAuthSessionDataCb;

class Controller {
    constructor() {
        if (!this.#hasSession()) {
            this.loadLoginView();
        } else {
            this.loadMainView();
        }
    }

    #hasSession = () => {
        let sessionData = localStorage.getItem(LS_SESSION_KEY);
        return sessionData != null && sessionData !== '';
    }

    loadTab = (tabName) => {
        switch (tabName) {
            case TAB_MAIN:
                this.loadMainView();
                break;
            case TAB_TRANSACTION:
                this.loadTransactionView();
                break;
            case TAB_SETTINGS:
                this.loadSettingsView();
                break;
            case TAB_ACCOUNTS:
                this.loadAccountsView();
                break;
            case TAB_FRIENDS:
                this.loadAssociationView();
                break;
        }
    }

    loadLoginView = () => {
        $('#content').load(`./views/${VIEW_LOGIN}`, () => {
            $('#reg-link').off('click').on('click', () => {
                this.loadRegistrationView();
            });

            let biometricReg = JSON.parse(localStorage.getItem(LS_BIOMETRY_REG) || '{}');
            if (biometricReg.subject != null) {
                let box = $('#biometric-sign-in-box');
                let userNameBox = $('#biometric-subject');
                userNameBox.text(biometricReg.subject);
                box.show();
            }

            $('#login-form').off('submit').on('submit', async (e) => {
                e.preventDefault();
                this.getDeviceInfo().then((deviceInfo) => {
                    RestClient.sendJSONRequest(AUTH_URL, 'POST', {
                            mode: 'create',
                            usernameOrEmail: $('#email-or-username').val(),
                            password: $('#password').val(),
                            deviceInfo: deviceInfo
                        },
                        (response) => {
                            if (response.error) {
                                alert("Failure " + response.error)
                            } else {
                                if (response.sessionData != null) {
                                    response.sessionData.keepLogged = $('#cb-save-session').is(':checked');
                                    localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                                    this.loadMainView();
                                    if (OAuthSessionDataCb != null) {
                                        OAuthSessionDataCb(response.sessionData);
                                    }
                                } else {
                                    alert("Login failed");
                                }
                            }
                        },
                        (error) => {
                            this.#showErrorAlert(error);
                        })
                });
            });
        });
    }

    loadAssociationView = () => {
        $('#content').load(`./views/${VIEW_FRIENDS}`, () => {
            showLoader('Please wait...');
            let addFriendButton = $('#add-friend');

            let friendRequestModal = $('#friendRequestModal');
            let friendRequestModalAdd = $('#friend-request-modal-add');
            let friendRequestModalClose = $('#friend-request-modal-close');
            let friendRequestModalUserName = $('#friend-request-username');

            friendRequestModalAdd.off('click').on('click', () => {
                let userToAdd = friendRequestModalUserName.val();
                if (userToAdd == null || userToAdd === '') {
                    alert("Username is required!");
                    return;
                }

                let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
                RestClient.sendJSONRequest(ADD_FRIENDS_ENDPOINT, 'POST', {
                        userName: userToAdd,
                        sessionData: sessionData
                    },
                    (response) => {
                        if (response.sessionData != null) {
                            this.startSessionTimer();
                        }
                        alert("Friend request sent successfully.");
                        friendRequestModal.modal('hide');
                    },
                    (error) => {
                        this.#showErrorAlert(error);
                        friendRequestModal.modal('hide');
                    });
            });

            friendRequestModalClose.off('click').on('click', () => {
                friendRequestModal.modal('hide');
            });

            addFriendButton.off('click').on('click', () => {
                friendRequestModalUserName.val('');
                friendRequestModal.modal('show');
            });
            this.refreshPendingFriendsList();
            this.refreshFriendsList();
            hideLoader();
        });
    }

    refreshFriendsList = () => {
        let friendsTableBody = $('#friends-table-body');
        let friendsTableEmptyBody = $('#friends-table-empty-body');
        friendsTableBody.empty();
        let friendRowTemplate = $($('#friend-row-template').html());
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        showLoader('Please wait...');
        $.ajax({
            url: GET_FRIENDS_ENDPOINT,
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                status: "ACCEPTED",
                sessionData: sessionData
            })
        }).done((response) => {
            if (response.sessionData != null) {
                response.sessionData.keepLogged = $('#cb-save-session').is(':checked');
                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                this.startSessionTimer();
            }
            let friends = response.friends;
            if (!friends || friends.length === 0) {
                friendsTableEmptyBody.show();
            } else {
                for (const friendsKey in friends) {
                    let friend = friends[friendsKey];
                    let friendElem = friendRowTemplate.clone().appendTo(friendsTableBody);
                    $('.name', friendElem).text(friend.username);
                    $('.alias', friendElem).text(friend.username);
                    $('.edit', friendElem).off('click').on('click', () => {
                        alert("Edit");
                    });

                    $('.delete', friendElem).off('click').on('click', () => {
                        alert("Delete");
                    });
                }
            }
            hideLoader();
        }).fail((error) => {
            this.#showErrorAlert(error);
            hideLoader();
        });
    }

    refreshPendingFriendsList = () => {
        let friendRequestsTableBody = $('#friend-requests-table-body');
        let friendRequestsEmptyTableBody = $('#friend-requests-empty-table-body');
        friendRequestsTableBody.empty();
        let friendRequestRowTemplate = $($('#friend-request-row-template').html());
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        showLoader('Please wait...');
        $.ajax({
            url: GET_FRIENDS_ENDPOINT,
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                status: "PENDING",
                sessionData: sessionData
            })
        }).done((response) => {
            if (response.sessionData != null) {
                response.sessionData.keepLogged = $('#cb-save-session').is(':checked');
                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                this.startSessionTimer();
            }
            let friends = response.friends;
            if (!friends || friends.length === 0) {
                friendRequestsEmptyTableBody.show();
            } else {
                for (const friendsKey in friends) {
                    let friend = friends[friendsKey];
                    let friendElem = friendRequestRowTemplate.clone().appendTo(friendRequestsTableBody);
                    $('.name', friendElem).text(friend.username);
                    $('.accept', friendElem).off('click').on('click', () => {
                        let userName = friend.username;
                        this.acceptFriendRequest(userName);
                    });

                    $('.decline', friendElem).off('click').on('click', () => {
                        let userName = friend.username;
                        this.declineFriendRequest(userName);
                    });
                }
            }

            hideLoader();
        }).fail((error) => {
            this.#showErrorAlert(error);
            hideLoader();
        });
    }

    declineFriendRequest = (requestUserName) => {
        this.#updateFriendRequestStatus(requestUserName, 'DECLINED');
    }

    acceptFriendRequest = (requestUsername) => {
        this.#updateFriendRequestStatus(requestUsername, 'ACCEPTED');
    }

    #updateFriendRequestStatus = (requestUsername, status) => {
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        showLoader('Please wait...');
        $.ajax({
            url: UPDATE_FRIENDS_URL,
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                action: 'updateStatus',
                status: status,
                userName: requestUsername,
                sessionData: sessionData
            })
        }).done((response) => {
            if (response.sessionData != null) {
                response.sessionData.keepLogged = $('#cb-save-session').is(':checked');
                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                this.startSessionTimer();
            }
            this.refreshPendingFriendsList();
            this.refreshFriendsList();
            alert(requestUsername + " is now your friend.");
            hideLoader();
        }).fail((error) => {
            this.refreshPendingFriendsList();
            this.refreshFriendsList();
            this.#showErrorAlert(error);
            hideLoader();
        });
    }

    #showErrorAlert = (error) => {
        var errorText = 'Error ' + error.status;
        if (error.responseJSON && error.responseJSON.message) {
            errorText = error.responseJSON.message;
        }
        alert(errorText);
    }

    loadTransactionView = () => {
        $('#content').load(`./views/${VIEW_TRANSACTION}`, () => {
            this.#getUserInfo().then((userInfo) => {
                if (!userInfo) {
                    alert("Failed to get the user info");
                    this.loadMainView();
                } else {
                    $('#transaction-details').off('submit').on('submit', (e) => {
                        e.preventDefault();
                        let amount = $('#amount-input').val();
                        let recipientAccNumber = $('#recipient-account-number').val();
                        let outgoingAccNum = $('#outgoing-account-number-select').val();
                        showLoader("Please wait...");
                        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
                        $.ajax({
                            url: TRANSACTION_URL,
                            method: 'POST',
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                amount: amount,
                                recipientAccountNumber: recipientAccNumber,
                                outgoingAccountNumber: outgoingAccNum,
                                sessionData: sessionData
                            })
                        }).done((response) => {
                            if (response.sessionData != null) {
                                response.sessionData.keepLogged = $('#cb-save-session').is(':checked');
                                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                                this.startSessionTimer();
                            }

                            if (!response.transactionId) {
                                alert("Error");
                            } else {
                                alert("Transaction completed: " + response.transactionId);
                            }

                            hideLoader();
                        }).fail((error) => {
                            var errorText = 'Error ' + error.status;
                            if (error.responseJSON && error.responseJSON.message) {
                                errorText = error.responseJSON.message;
                            }
                            alert(errorText);
                            hideLoader();
                        });
                    });

                    let accountOptionTemplate = $($('#out-account-number-option-template').html());
                    let accountsContainer = $('#outgoing-account-number-select');
                    for (var userAccountKey in userInfo.userAccounts) {
                        let accountInfo = userInfo.userAccounts[userAccountKey];
                        let template = accountOptionTemplate.clone().appendTo(accountsContainer);
                        if (accountInfo.isPrimary) {
                            template.attr('selected', true);
                        }
                        template.val(accountInfo.number);
                        template.text(accountInfo.name + " (" + accountInfo.balance + ")");
                    }
                }
            });
        });
    }

    loadMainView = () => {
        $('#content').load(`./views/${VIEW_MAIN}`, () => {
            let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
            $('#username').text(sessionData.subject);
            $('#navbar').show();
            this.startSessionTimer();
        });
    }

    loadAccountsView = () => {
        $('#content').load(`./views/${VIEW_ACCOUNTS}`, () => {
            this.#getUserInfo().then((userInfo) => {
                if (!userInfo) {
                    alert("Failed to get the user info");
                    this.loadMainView();
                } else {
                    this.#drawAccounts(userInfo);
                }
            });
        });
    }

    loadSettingsView = () => {
        $('#content').load(`./views/${VIEW_SETTINGS}`, () => {
            let biometricReg = JSON.parse(localStorage.getItem(LS_BIOMETRY_REG) || '{}');
            let setupButton = $('#setup-biometrics');
            let removeBiometrics = $('#remove-biometrics');
            if (biometricReg.subject != null) {
                setupButton.hide();

                removeBiometrics.show();
                removeBiometrics.off('click').on('click', () => {
                    BiometryFacade.deleteRegistration();
                });
            } else {
                removeBiometrics.hide();
                BiometryFacade.isBiometricsAvailable(() => {
                        setupButton.off('click').on('click', (e) => {
                            e.preventDefault();
                            BiometryFacade.enroll();
                        });
                    },
                    () => {
                        alert("Biometrics API not available");
                        setupButton.hide();
                    });
            }
        });
    }

    loadRegistrationView = () => {
        $('#content').load(`./views/${VIEW_REG}`, () => {
            $('#login-link').off('click').on('click', () => {
                this.loadLoginView();
            });

            $('#reg-form').off('submit').on('submit', async (e) => {
                e.preventDefault();
                showLoader("Processing...");
                this.getDeviceInfo().then((deviceInfo) => {
                    $.ajax({
                        url: REG_URL,
                        method: "POST",
                        dataType: "json",
                        contentType: 'application/json',
                        data: JSON.stringify({
                            firstname: $('#firstname').val(),
                            lastname: $('#lastname').val(),
                            dateOfBirth: $('#date-of-birth').val(),
                            userName: $('#username-reg').val(),
                            phoneNumber: $('#phoneNumber').val(),
                            email: $('#email').val(),
                            password: $('#password').val(),
                            passwordConfirmation: $('#password-confirm').val(),
                            deviceInfo: deviceInfo
                        })
                    }).done((response) => {
                        if (response.error) {
                            alert("Failure " + response.error)
                        } else {
                            alert(response.message);
                            if (response.sessionData != null) {
                                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                                this.loadMainView();
                            } else {
                                this.loadLoginView();
                            }
                        }
                        hideLoader();
                    }).fail((error) => {
                        var errorText = 'Error ' + error.status;
                        if (error.responseJSON && error.responseJSON.message) {
                            errorText = error.responseJSON.message;
                        }
                        alert(errorText);
                        hideLoader();
                    });
                });
            });
        });
    }

    startSessionTimer = () => {
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        setTimeout(() => {
            if (sessionData.keepLogged) {
                $.ajax({
                    url: AUTH_URL,
                    method: "POST",
                    dataType: "json",
                    contentType: 'application/json',
                    data: JSON.stringify({
                        mode: 'renew', sessionData: sessionData
                    })
                }).done((response) => {
                    if (response.sessionData != null) {
                        response.sessionData.keepLogged = sessionData.keepLogged;
                        localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
                        this.loadLoginView();
                    } else {
                        this.logout();
                    }
                }).fail(() => {
                    this.logout();
                });
            } else {
                this.logout();
            }
        }, (sessionData.expiry * 1000));
    }

    #getUserInfo = () => {
        return new Promise((resolve) => {
            showLoader("Please wait...");
            let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
            $.ajax({
                url: USER_INFO_URL,
                method: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({sessionData})
            }).done((response) => {
                if (response.sessionData != null) {
                    this.updateSession(response.sessionData);
                }
                hideLoader();
                resolve(response.userInfo);
            }).fail(() => {
                resolve(null);
                hideLoader();
            });
        });
    }

    getDeviceInfo = () => {
        return new Promise(function (resolve) {
            cordova.plugins.firebase.messaging.getToken().then((regId) => {
                resolve({
                    platform: device.platform,
                    manufacturer: device.manufacturer,
                    model: device.model,
                    version: device.version,
                    deviceId: device.uuid,
                    push: {
                        registrationId: regId
                    }
                });
            });
        });
    }

    #drawAccounts = (userInfo) => {
        let container = $('#accounts-table');
        if (!userInfo.userAccounts) {
            return;
        }

        for (var userAccountKey in userInfo.userAccounts) {
            let accountInfo = userInfo.userAccounts[userAccountKey];
            let template = $($('#account-template').html());
            $('.account-name', template).html(accountInfo.name);
            $('.account-balance', template).html(accountInfo.balance);
            $('.account-number', template).html(accountInfo.number);
            template.appendTo(container);
        }
    }

    logout = () => {
        $('#navbar').hide();
        $('#username').text('');
        localStorage.removeItem(LS_SESSION_KEY);
        this.loadLoginView();
    }

    updateSession(sessionData) {
        sessionData.keepLogged = $('#cb-save-session').is(':checked');
        localStorage.setItem(LS_SESSION_KEY, JSON.stringify(sessionData));
        this.startSessionTimer();
    }

    handlePushNotification(payload) {
        console.log("New background FCM message: ", payload);
        if (payload.type === 'transactionDetails') {
            let modal = $('#transactionDetailsModal');
            $('#transactionId').text(payload.transactionId);
            $('#senderAccount').text(payload.sender);
            $('#receivedTo').text(payload.receivedTo);
            $('#amount').text(payload.amount);
            modal.modal('show');
            return;
        }

        if (payload.type === 'transactionConfirmation') {
            BiometryFacade.authorize(payload.transactionId);
        }
    }
}

/**
 * Shows loader text with spinning animation.
 */
function showLoader(text) {
    var loader = $('<div>', {'id': 'loader'});
    var content = $('<div>', {'class': 'loader-content'}).appendTo(loader);
    $('<div>', {'class': 'loader-icon'}).appendTo(content);
    $('<div>', {'class': 'loader-text', 'text': text}).appendTo(content);
    loader.appendTo(document.body);
    $('<div>', {'id': 'loader-bg'}).appendTo(document.body);
}

function arrayBufferToBase64(arrayBuffer) {
    var byteArray = new Uint8Array(arrayBuffer);
    var byteString = '';
    for (var i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    return window.btoa(byteString);
}

class BiometryFacade {
    static authorize(transactionId) {
        let biometryReg = JSON.parse(localStorage.getItem(LS_BIOMETRY_REG));
        return this.#initAuth(biometryReg.subject).then((response) => {
            if (response == null) {
                alert("Rest request failed");
                return;
            }

            Fingerprint.loadBiometricSecret({
                    title: "Biometric sign-on",
                    description: `Authenticate user ${biometryReg.subject}`,
                    disableBackup: false,
                },
                (privateKeyPem) => {
                    CryptoUtils.toPrivateCryptoKey(privateKeyPem).then((privateKey) => {
                        return crypto.subtle.sign({
                                name: "RSA-PSS",
                                saltLength: 32
                            },
                            privateKey,
                            new TextEncoder().encode(response.challenge)).then((signature) => {
                            let signedChallenge = btoa(String.fromCharCode(...new Uint8Array(signature)));
                            return {
                                signature: signedChallenge,
                                challenge: response.challenge,
                                subject: response.subject,
                            };
                        }).then((authResult) => {
                            if (authResult == null) {
                                alert("Authentication failed.");
                                return;
                            }
                            authResult.correlationId = response.correlationId;
                            if (transactionId != null) {
                                authResult.transactionId = transactionId;
                            }
                            return this.#finishAuth(authResult);
                        });
                    });
                },
                () => {
                    alert("Authentication failed");
                });
        });
    }

    static #initAuth = (subject) => {
        return new Promise((resolve) => {
            showLoader("Please wait...");
            gController.getDeviceInfo().then((deviceInfo) => {
                $.ajax({
                    url: BIOMETRY_AUTH_URL,
                    method: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        operation: "INIT_AUTH",
                        deviceInfo: deviceInfo,
                        subject: subject
                    })
                }).done((response) => {
                    hideLoader();
                    resolve({
                        challenge: response.challenge,
                        correlationId: response.correlationId,
                        subject,
                    });
                }).fail((error) => {
                    var errorText = 'Error ' + error.status;
                    if (error.responseJSON && error.responseJSON.message) {
                        errorText = error.responseJSON.message;
                    }
                    alert(errorText);
                    hideLoader();
                    resolve(null);
                });
            });
        });
    }

    static #finishAuth = (result) => {
        return new Promise((resolve) => {
            showLoader("Please wait...");
            gController.getDeviceInfo().then((deviceInfo) => {
                $.ajax({
                    url: BIOMETRY_AUTH_URL,
                    method: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        operation: "FINISH_AUTH",
                        message: btoa(JSON.stringify(result)),
                        deviceInfo: deviceInfo,
                        subject: result.subject
                    })
                }).done((response) => {
                    if (response.sessionData != null) {
                        if (result.transactionId != null) {
                            alert("Transaction confirmation successful");
                            hideLoader();
                            return;
                        }

                        gController.updateSession(response.sessionData);
                        gController.loadMainView();
                        if (OAuthSessionDataCb != null) {
                            OAuthSessionDataCb(response.sessionData);
                        }
                        resolve(true);
                    } else {
                        alert("Failed to authentication the user.");
                        resolve(false);
                    }

                    hideLoader();
                }).fail((error) => {
                    var errorText = 'Error ' + error.status;
                    if (error.responseJSON && error.responseJSON.message) {
                        errorText = error.responseJSON.message;
                    }
                    alert(errorText);
                    hideLoader();
                    resolve(null);
                });
            });
        });
    }

    static enroll() {
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        if (sessionData == null) {
            alert("Session is required");
            return;
        }

        this.#intReg(sessionData).then((response) => {
            if (response == null) {
                alert("Rest request failed");
                return;
            }

            return CryptoUtils.generateRSAPSSKeyPair(2048).then((keyPair) => {
                return crypto.subtle.sign({
                    name: "RSA-PSS",
                    saltLength: 32
                }, keyPair.privateKey.raw, new TextEncoder().encode(response.challenge))
                    .then((signature) => {
                        let signedChallenge = btoa(String.fromCharCode(...new Uint8Array(signature)));
                        return new Promise((resolve) => {
                            Fingerprint.registerBiometricSecret({
                                title: "Set-up biometric sign-on",
                                description: `Register authenticator for user ${sessionData.subject}`,
                                secret: keyPair.privateKey.pem,
                                invalidateOnEnrollment: true
                            }, () => {
                                resolve({
                                    signature: signedChallenge,
                                    pubKey: keyPair.publicKey.pem,
                                    challenge: response.challenge
                                });
                            }, () => {
                                resolve(null);
                            });
                        })
                    }).then((regResult) => {
                        if (regResult == null) {
                            alert("Registration failed, please try again.");
                            return;
                        }
                        regResult.correlationId = response.correlationId;
                        return this.#finishReg(regResult);
                    }).then((succeeded) => {
                        if (!succeeded) {
                            return;
                        }

                        showLoader("Saving the registration...");
                        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
                        localStorage.setItem(LS_BIOMETRY_REG, JSON.stringify({
                            publicKey: keyPair.publicKey,
                            subject: sessionData.subject
                        }));
                        gController.loadSettingsView();
                        hideLoader();
                    });
            })
        });
    }

    static #intReg = (sessionData) => {
        return new Promise((resolve) => {
            showLoader("Please wait...");
            gController.getDeviceInfo().then((deviceInfo) => {
                $.ajax({
                    url: BIOMETRY_REG_URL,
                    method: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        operation: "INIT_REG",
                        deviceInfo: deviceInfo,
                        sessionData: sessionData
                    })
                }).done((response) => {
                    if (response.sessionData != null) {
                        gController.updateSession(response.sessionData);
                    }
                    hideLoader();
                    resolve({
                        challenge: response.challenge, correlationId: response.correlationId
                    });
                }).fail((error) => {
                    var errorText = 'Error ' + error.status;
                    if (error.responseJSON && error.responseJSON.message) {
                        errorText = error.responseJSON.message;
                    }
                    alert(errorText);
                    hideLoader();
                    resolve(null);
                });
            });
        });
    }

    static #finishReg = (regResult) => {
        return new Promise((resolve) => {
            showLoader("Please wait...");
            let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
            if (sessionData == null) {
                alert("Session is required");
                return;
            }

            gController.getDeviceInfo().then((deviceInfo) => {
                $.ajax({
                    url: BIOMETRY_REG_URL,
                    method: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        operation: "FINISH_REG",
                        message: btoa(JSON.stringify(regResult)),
                        deviceInfo: deviceInfo,
                        sessionData: sessionData
                    })
                }).done((response) => {
                    if (response.sessionData != null) {
                        gController.updateSession(sessionData);
                    }

                    if (!response.status) {
                        alert("Error");
                        resolve(false);
                    } else {
                        alert("Successfully registered fingerprint credential");
                        resolve(true);
                    }

                    hideLoader();
                }).fail((error) => {
                    var errorText = 'Error ' + error.status;
                    if (error.responseJSON && error.responseJSON.message) {
                        errorText = error.responseJSON.message;
                    }
                    alert(errorText);
                    hideLoader();
                    resolve(null);
                });
            });
        });
    }

    static deleteRegistration = () => {
        showLoader("Please wait...")
        let sessionData = JSON.parse(localStorage.getItem(LS_SESSION_KEY));
        gController.getDeviceInfo().then((deviceInfo) => {
            $.ajax({
                url: BIOMETRY_REG_URL,
                method: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({
                    operation: "DELETE_REG",
                    deviceInfo: deviceInfo,
                    sessionData: sessionData
                })
            }).done((response) => {
                console.log(response);
                localStorage.removeItem(LS_BIOMETRY_REG);
                gController.loadSettingsView();
                hideLoader();
            }).fail((error) => {
                console.log(error);
                gController.loadSettingsView();
                hideLoader();
            });
        });
    }

    static isBiometricsAvailable(onSuccess, onFailure) {
        Fingerprint.isAvailable(onSuccess, onFailure);
    }
}

/**
 * Hides the loader animation.
 */
function hideLoader() {
    $('#loader').remove();
    $('#loader-bg').remove();
}

$(document).on('deviceready', () => {
    window.gController = new Controller();
    universalLinks.subscribe("alexaLinkageEvent", function (eventData) {
        let userConsentModal = $('#userConsentModal');
        let userConsentAllowBtn = $('#consent-allowed');
        let userConsentDeclineBtn = $('#consent-declined');
        let oauthSupport = new OAuthSupport();
        oauthSupport.setCodeRequestParams(eventData.params);
        return new Promise((resolve) => {
            if (localStorage.getItem(LS_SESSION_KEY) == null) {
                OAuthSessionDataCb = resolve;
            } else {
                resolve(JSON.parse(localStorage.getItem(LS_SESSION_KEY)));
            }

            console.log(eventData);
        }).then((sessionData) => {
            $('.oauth-client-name', userConsentModal).text(ALEXA_APP_NAME);
            userConsentAllowBtn.off('click').on('click', () => {
                oauthSupport.process(sessionData);
            });

            userConsentDeclineBtn.off('click').on('click', () => {
                oauthSupport.processCancel();
            });

            userConsentModal.modal('show');
        });
    });

    cordova.plugins.firebase.messaging.onMessage(gController.handlePushNotification);
    cordova.plugins.firebase.messaging.onBackgroundMessage(gController.handlePushNotification);
});
