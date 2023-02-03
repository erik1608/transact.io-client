let OAuthSupport = function () {
    // The caller state.
    let state;

    // The caller client_id.
    let client_id;

    // Caller callback URI redirect_uri
    let redirect_uri;

    // Requested scope.
    let scope;

    let timeoutInterval = 2000;

    this.setCodeRequestParams = (params) => {
        client_id = params.client_id;
        state = params.state;
        scope = params.scope;
        redirect_uri = params.redirect_uri;
    }

    this.process = (sessionData) => {
        showLoader("Please wait...");
        getAuthCode(sessionData).then((response) => {
            hideLoader();
            if (response.code == null || response.state == null) {
                console.log("Rejecting the request with response: " + response.error + " : " + response.error_description)
                return Promise.reject({
                    error: "access_denied",
                    error_description: "The user denied the request"
                });
            }
            window.open(getSuccessCallbackUrl(response), '_blank');
        }).catch((err) => {
            hideLoader();
            setTimeout(() => {
                location.href = getFailureCallbackURL(err);
            }, timeoutInterval)
        });
    }

    this.processCancel = () => {
        window.open(getFailureCallbackURL({
            error: "access_denied",
            error_description: "The user denied the request"
        }), '_blank');
    }

    function getSuccessCallbackUrl(response) {
        return `${redirect_uri}/?code=${response.code}&state=${response.state}`
    }

    function getFailureCallbackURL(response) {
        return `${redirect_uri}/?error=${response.error}&error_description=${response.error_description}&state=${state}`
    }

    function getAuthCode(sessionData) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: OAUTH_CODE_URL,
                method: "POST",
                dataType: "json",
                contentType: 'application/json; charset=UTF-8',
                data: JSON.stringify({
                    'sessionData': sessionData,
                    'response_type': 'code',
                    'scope': scope,
                    'client_id': client_id,
                    'state': state,
                    'redirect_uri': redirect_uri,
                }),
                success: resolve,
                error: (xhr) => {
                    if (xhr.readyState === 0) {
                        reject({
                            error: "invalid_request",
                            error_description: "Device is not connected to the Internet"
                        });
                        return;
                    }

                    if (!xhr.responseJSON || (!xhr.responseJSON.error && !xhr.responseJSON.error_description)) {
                        reject({
                            error: "invalid_request",
                            error_description: "Internal server error occurred"
                        });
                        return;
                    }

                    reject(xhr.responseJSON);
                }
            });
        });
    }
}
