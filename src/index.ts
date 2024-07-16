import { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { Swagger2HarV2 } from "./Swagger2HarV2";
import { Swagger2HarV3 } from "./Swagger2HarV3";

export interface Param {
    name: string
    value: string
}


export function Swagger2Har(config: OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document) {
    if ((config as OpenAPIV2.Document).swagger === "2.0") {
        return Swagger2HarV2(config as OpenAPIV2.Document);
    } else if ((config as OpenAPIV3.Document).openapi.startsWith("3")) {
        return Swagger2HarV3(config as OpenAPIV3.Document);
    }
    return [];
}

