class RestClient {

    /**
     * Send a request and receive a response in either success or failure callbacks.
     * @param url             The url to send request to.
     * @param method          The request method (POST, GET, etc.)
     * @param data            The data to be sent.
     * @param successCB       Success callback.
     * @param failureCB       Failure callback.
     * @param sessionRequired Is session required for the endpoint.
     */
    static sendJSONRequest(url, method, data, successCB, failureCB, sessionRequired) {
        showLoader('Please wait...')
        $.ajax({
            url: url,
            method: method,
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(data)
        }).done((response) => {
            if (response.sessionData != null) {
                localStorage.setItem(LS_SESSION_KEY, JSON.stringify(response.sessionData));
            }
            hideLoader();
            successCB(response);
        }).fail((error) => {
            hideLoader();
            failureCB(error);
        });
    }
}