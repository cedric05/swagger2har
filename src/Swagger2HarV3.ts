/**
 * Converts a Swagger/OpenAPI v3 document into an array of HAR (HTTP Archive) objects.
 * Each HAR object represents a request defined in the Swagger/OpenAPI document.
 *
 * @param config - The Swagger/OpenAPI v3 document.
 * @returns An array of HAR objects representing the requests defined in the document.
 */

import instantiate from "json-schema-instantiator";
import { OpenAPIV3 } from "openapi-types";
import { Param } from ".";

function getPostData(methodObj: OpenAPIV3.OperationObject, config: OpenAPIV3.Document<{}>) {
    const requestBody = methodObj.requestBody;
    if (requestBody !== undefined) {
        var bodySchema: any;
        var content;
        var contentType;
        if ('$ref' in requestBody) {
            const requestBodyId = requestBody.$ref.replace('#/components/requestBodies/', '');
            content = (config.components?.requestBodies ?? {})[requestBodyId];
        } else {
            content = requestBody.content;
        }
        if ('application/json' in content) {
            const schema = content['application/json'].schema ?? {};
            if ('$ref' in schema) {
                const schemaRef = schema.$ref;
                const schemaId = schemaRef.replace('#/components/schemas/', '');
                bodySchema = (config.components?.schemas ?? {})[schemaId];
            } else {
                bodySchema = schema;
            }
            contentType = 'application/json';
        } else if ('application/x-www-form-urlencoded' in content) {
            bodySchema = content['application/x-www-form-urlencoded'].schema;
            contentType = 'application/x-www-form-urlencoded';
        }
        if (bodySchema) {
            bodySchema.components = config.components ?? {};
            var body = instantiate(bodySchema);
            var postData = null;
            if (typeof body === "object") {
                if (contentType === "application/json") {
                    postData = {
                        "mimeType": contentType,
                        "text": JSON.stringify(body)
                    };
                } else if (contentType === "application/x-www-form-urlencoded") {
                    postData = {
                        "mimeType": contentType,
                        "params": Object.keys(body).map((k) => ({
                            "name": k,
                            "value": body[k]
                        })),
                    };
                }
            }
            else {
                postData = {
                    "mimeType": "text/plain",
                    "text": body
                };
            }
            return postData;
        }
    }
    return null;
}





export function getQueryHeaderAndUrlFromParams(params: Array<OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject>, config: OpenAPIV3.Document, url: string) {
    const queryParams: Array<Param> = [];
    const headersParams: Array<Param> = [];
    const bodyForm: { [key: string]: any; } = {};
    params.forEach((p) => {
        if ("$ref" in p) {
            var ref = p['$ref'].replace("#/components/parameters/", '');
            p = (config.components?.parameters ?? {})[ref];
        }
        var param = p as OpenAPIV3.ParameterObject;
        if (param.in === "query") {
            queryParams.push({
                name: param['name'],
                value: `{{${param['name']}}}`
            });
        }
        else if (param.in === "path") {
            console.log('url', url, 'param', param);
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
    });
    return { headersParams, queryParams, url };
}

function covertOpenApi3MethodObjectToHar(meh: string, pathObj: OpenAPIV3.PathItemObject<{}>, config: OpenAPIV3.Document<{}>, server: string, path: string) {
    const method = meh as keyof OpenAPIV3.PathItemObject;
    const methodObj = pathObj[method] as OpenAPIV3.OperationObject;
    const { queryParams, headersParams, url } = getQueryHeaderAndUrlFromParams(methodObj.parameters ?? [], config, server + path); // @ts-ignore
    var postData = getPostData(methodObj, config);
    const harObject = {
        method: method.toUpperCase(),
        url: url,
        query: queryParams,
        headers: headersParams,
        postData: postData,
    };
    console.log(methodObj);
    return harObject;
}


export function Swagger2HarV3(config: OpenAPIV3.Document): any[] {
    const server = (config.servers ?? [{ url: 'http://localhost:8000' }])[0].url;
    const hars: Array<any> = [];
    Object.keys(config.paths).forEach((path) => {
        const pathObj = config.paths[path] as OpenAPIV3.PathItemObject;
        Object.keys(pathObj).forEach((meh) => {
            const harObject = covertOpenApi3MethodObjectToHar(meh, pathObj, config, server, path);
            hars.push(harObject);
        });
    });
    return hars;
}
