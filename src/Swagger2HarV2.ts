

import instantiate from "json-schema-instantiator";
import { OpenAPIV2 } from "openapi-types";
import { Param } from ".";

/**
 * Retrieves individual parameters from the OpenAPIv2 document.
 * @param params - The parameters defined in the OpenAPIv2 document.
 * @param config - The OpenAPIv2 document.
 * @param url - The URL of the request.
 * @returns An object containing the individual parameters, including query parameters, header parameters, request body, and URL.
 */
export function getHeaderQueryBodyUrlFromParams(params: OpenAPIV2.Parameters, config: OpenAPIV2.Document<{}>, url: string) {
    const queryParams: Array<Param> = [];
    const headersParams: Array<Param> = [];
    const bodyForm: { [key: string]: any; } = {};
    var body: any = {};

    params.forEach((p) => {
        var param = (p['$ref'] ? (config.parameters ?? {})[p['$ref'].replace("#/parameters/", '')] : p) as OpenAPIV2.ParameterObject;

        if (param.in === "query") {
            queryParams.push({
                name: param['name'],
                value: `{{${param['name']}}}`
            });
        }
        else if (param.in === "path") {
            url = url.replace(`{${param['name']}}`, `{{${param['name']}}}`);
        }
        else if (param.in === "header") {
            headersParams.push({
                name: param['name'],
                value: `{{${param['name']}}}`
            });
        }
        else if (param.in === "formData") {
            bodyForm[param['name']] = `{{${param['name']}}}`;
        }
        else if (param.in === "body") {
            var currentBodySchema: any = {};

            if ("schema" in param) {
                if ("$ref" in param['schema']) {
                    const schemaRef = param['schema']['$ref'];
                    const schemaId = schemaRef.replace("#/definitions/", '');
                    currentBodySchema = (config.definitions ?? {})[schemaId];
                } else {
                    currentBodySchema = param['schema'];
                }
            } else {
                currentBodySchema = param['name'];
            }

            currentBodySchema.definitions = config.definitions; // tsc-ignore
            body = instantiate(currentBodySchema);
        }
    });

    var postData = null;

    if (Object.keys(bodyForm).length > 0) {
        postData = {
            "mimeType": "application/x-www-form-urlencoded",
            "params": Object.keys(bodyForm).map((k) => {
                return {
                    "name": k,
                    "value": bodyForm[k]
                };
            })
        };
    } else if (Object.keys(body).length > 0) {
        if (typeof body === "object") {
            postData = {
                "mimeType": "application/json",
                "text": JSON.stringify(body)
            };
        } else {
            postData = {
                "mimeType": "text/plain",
                "text": body
            };
        }
    }

    return { headersParams, queryParams, postData, url };
}

/**
 * Converts an OpenAPIv2 method object to a HAR object.
 * @param method - The HTTP method.
 * @param pathObj - The OpenAPIv2 path object.
 * @param baseUrl - The base URL of the API.
 * @param path - The path of the API endpoint.
 * @param config - The OpenAPIv2 document.
 * @returns The HAR object representing the API request.
 */
function covertOpenApi2MethodObjectToHarObject(method: keyof OpenAPIV2.PathItemObject, pathObj: OpenAPIV2.PathItemObject<{}>, baseUrl: string, path: string, parameters: OpenAPIV2.Parameters, config: OpenAPIV2.Document<{}>) {
    const methodObj = pathObj[method] as OpenAPIV2.OperationObject; // get the method object
    var url = `${baseUrl}${path}`;

    // get params object, try to figure out the query params
    const params = methodObj.parameters ?? [];
    params.push(...parameters);
    let headersParams: Array<Param> | undefined;
    let queryParams: Array<Param> | undefined;
    var postData;

    ({ headersParams, queryParams, postData, url } = getHeaderQueryBodyUrlFromParams(params, config, url));

    // construct har format and append to hars
    const har = {
        "method": method,
        "url": url,
        "headers": headersParams,
        "queryString": queryParams,
        "postData": postData
    };

    return har;
}

/**
 * Converts an OpenAPIv2 document to an array of HAR objects.
 * @param config - The OpenAPIv2 document.
 * @returns An array of HAR objects representing the API requests.
 */
export function Swagger2HarV2(config: OpenAPIV2.Document) {
    const host = config.host ?? "localhost";
    const basePath = config.basePath ?? "";
    const schemes = config.schemes ?? ["http"];
    const scheme = schemes[0];
    const baseUrl = `${scheme}://${host}${basePath}`;
    const hars: Array<any> = [];

    Object.keys(config.paths).forEach((path) => {
        const pathObj = config.paths[path];
        const parameters = pathObj.parameters ?? [];
        Object.keys(pathObj).forEach((method) => {
            if (method === "parameters") {
                return;
            }
            hars.push(covertOpenApi2MethodObjectToHarObject(method as keyof OpenAPIV2.PathItemObject, pathObj, baseUrl, path, parameters, config));
        });
    });

    return hars;
}