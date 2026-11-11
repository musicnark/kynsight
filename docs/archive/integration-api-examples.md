## API Examples

### Companies House (Officers)

E.g.,
```text
GET: https://api.company-information.service.gov.uk/company/04092583/officers
```

#### Succesful Responses

```json
{
  "active_count": 4,
  "etag": "34fbaac554a88b663ce847e53dcead20741ed6e8",
  "items": [
    {
      "etag": "34fbaac554a88b663ce847e53dcead20741ed6e8",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 9,
        "year": 1980
      },
      "links": {
        "self": "/company/04092583/appointments/hV1_dP1m-YVi0iqDUfuKr5vwA88",
        "officer": {
          "appointments": "/officers/ZRyC2paUG5Ib8faowIg165pLg78/appointments"
        }
      },
      "name": "BISHOP, Adam Roy",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "68324340004",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "787a48a7a9acd7aca7c06917022abd72cac902ab",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2024-01-24",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 8,
        "year": 1977
      },
      "links": {
        "self": "/company/04092583/appointments/I2x4RM65h-0d8cngTNrHFIP9d9w",
        "officer": {
          "appointments": "/officers/trN4OFd8TCPnr7U0mOSVQ3q-a-k/appointments"
        }
      },
      "name": "BLOCH, Nathan, Mr.",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "256167250002",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "d16750a19ebd51197831d8cafbf65dfc1159ad44",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2021-01-21",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 3,
        "year": 1987
      },
      "links": {
        "self": "/company/04092583/appointments/__3us32AN-P055-du4NysXveKpM",
        "officer": {
          "appointments": "/officers/K9pSTIIoO9Pe5hieiRmofkQILGg/appointments"
        }
      },
      "name": "COWLING, Simon",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "279063080001",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "133f2da9ba245d9fe6163d63c770e163d66feef7",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2024-01-24",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 9,
        "year": 1983
      },
      "links": {
        "self": "/company/04092583/appointments/OQPhNyO7LR7LosPqulGPuehrVzw",
        "officer": {
          "appointments": "/officers/7rHx3Wb-awd9C-j0xtMKBZ9dxpQ/appointments"
        }
      },
      "name": "MAKH, Suniel Singh",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "245295100002",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "8c86e5f6d5bfa012a3a36afa50d3b858c7a97987",
      "address": {
        "address_line_1": "252 Maplin Way North",
        "locality": "Southend On Sea",
        "postal_code": "SS1 3NT",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/gBYXS1SkYlnKZRPL-AXD380vt7g",
        "officer": {
          "appointments": "/officers/7G9BWrZ-4FjaVi2Wetr3xQ_2dWs/appointments"
        }
      },
      "name": "BISHOP, Rowland Roy",
      "nationality": "British",
      "officer_role": "secretary",
      "resigned_on": "2021-03-10",
      "person_number": "69279260001"
    },
    {
      "etag": "5a3d56e5dee2b7d0ef6ac5e89684cbf4c9c92fdd",
      "address": {
        "address_line_1": "25 Hill Road",
        "address_line_2": "Theydon Bois",
        "locality": "Epping",
        "postal_code": "CM16 7LX",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/LTMsYjogjdFhW0OdBvSMj7LlAb8",
        "officer": {
          "appointments": "/officers/fK3CeAyC04VjYkiOCFNfE_Kw3Ug/appointments"
        }
      },
      "name": "THEYDON SECRETARIES LIMITED",
      "officer_role": "corporate-nominee-secretary",
      "resigned_on": "2000-10-18",
      "person_number": "900011300001"
    },
    {
      "etag": "531808bd3f87b4a64bc21502199d2fe04b608403",
      "address": {
        "country": "England",
        "locality": "Southend On Sea",
        "postal_code": "SS1 3NT",
        "premises": "252 Maplin Way North",
        "region": "Essex"
      },
      "appointed_on": "2015-04-16",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 12,
        "year": 1951
      },
      "links": {
        "self": "/company/04092583/appointments/WTANpmKbKScQPSvVyiIXgCj4sIg",
        "officer": {
          "appointments": "/officers/7G9BWrZ-4FjaVi2Wetr3xQ_2dWs/appointments"
        }
      },
      "name": "BISHOP, Rowland Roy",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2021-03-10",
      "person_number": "69279260001"
    },
    {
      "etag": "9149b608cb1f8d946c5b8fcf12e09124d908e725",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2015-06-04",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 6,
        "year": 1960
      },
      "links": {
        "self": "/company/04092583/appointments/NGQSsp2KxSzCcFADDDZKYfdMKs8",
        "officer": {
          "appointments": "/officers/82VfzSVxaTnsqQSbJAOdaWLzM-U/appointments"
        }
      },
      "name": "KIPPIN, Colin",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2026-01-06",
      "person_number": "199132790003",
      "identity_verification_details": {
        "appointment_verification_statement_due_on": "2026-10-29"
      }
    },
    {
      "etag": "d04e846667cfcf9c1046638d434046d515600ae8",
      "address": {
        "address_line_1": "19 Clifftown Road",
        "country": "United Kingdom",
        "locality": "Southend-On-Sea",
        "postal_code": "SS1 1AB",
        "premises": "1st Floor",
        "region": "Essex"
      },
      "appointed_on": "2021-01-21",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 5,
        "year": 1970
      },
      "links": {
        "self": "/company/04092583/appointments/UouS18xpSq2d-MVwdC-fUI5odRU",
        "officer": {
          "appointments": "/officers/c7ga19LCbWRA1V_F9mtIYzNQaJg/appointments"
        }
      },
      "name": "NEAL, Sean",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2024-08-30",
      "person_number": "279063090001"
    },
    {
      "etag": "3b2fbb4325c376e7ec1afaef67cac34fd9b223f0",
      "address": {
        "locality": "Southend On Sea",
        "postal_code": "SS1 1EH",
        "premises": "7 Nelson Street",
        "region": "Essex"
      },
      "appointed_on": "2015-12-09",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 7,
        "year": 1969
      },
      "links": {
        "self": "/company/04092583/appointments/1gib9s_YIKa9SwHqmZ1kgrgbb74",
        "officer": {
          "appointments": "/officers/R52zz4wwnvq7h1Nl2_5ZZdGVoug/appointments"
        }
      },
      "name": "PRICE, John Barry",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2020-01-23",
      "person_number": "91636770001"
    },
    {
      "etag": "37384188f53146e4bff852eecf3e22097414b4fb",
      "address": {
        "address_line_1": "25 Hill Road",
        "address_line_2": "Theydon Bois",
        "locality": "Epping",
        "postal_code": "CM16 7LX",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/NQrLQ-UL9XIWwlzjd4Ta7bIDKag",
        "officer": {
          "appointments": "/officers/ErqAB1SjwinvXO9y-aUGFwK67yA/appointments"
        }
      },
      "name": "THEYDON NOMINEES LIMITED",
      "officer_role": "corporate-nominee-director",
      "resigned_on": "2000-10-18",
      "person_number": "900010330001"
    }
  ],
  "items_per_page": 35,
  "kind": "officer-list",
  "links": {
    "self": "/company/04092583/officers"
  },
  "resigned_count": 7,
  "inactive_count": 0,
  "start_index": 0,
  "total_results": 11
}
```

#### Empty Responses
```json
{
  "active_count": 0,
  "etag": "",
  "items": [],
  "items_per_page": 35,
  "kind": "officer-list",
  "links": {},
  "resigned_count": 0,
  "inactive_count": 0,
  "start_index": 0,
  "total_results": 0
}
```

#### Error Responses
```json
{
  "timestamp": "2026-11-10T09:24:21.990451753",
  "message": "No static resource company/05092583/officer for request '/company/05092583/officer'.",
  "request_id": "ci5aafwvOHy-tnB0sSwrNDN-kYUl"
}
```

### Vett

E.g.,
```sh
curl --request POST \
  --url https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all \
  --header "Content-Type: application/json" \
  --header "x-rapidapi-host: global-sanctions-export-control-screener.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  --data '{"name":"POTANIN, Vladimir","threshold":85}'
```

#### Succesful Responses
```json
{
  "input": "POTANIN, Vladimir",
  "is_match": true,
  "matches": [
    {
      "list_name": "OFAC",
      "name": "Vladimir Olegovich Potanin",
      "score": 90,
      "source": "OFAC_SDN",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "CSL",
      "name": "Potanin Vladimir Olegovich",
      "score": 90,
      "source": "Specially Designated Nationals (SDN) - Treasury Department",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "AUSTRALIA_DFAT",
      "name": "Vladimir Olegovich Potanin",
      "score": 90,
      "source": "Autonomous (Russia) - 2022-04-06",
      "entity_type": "Person",
      "programs": []
    },
    {
      "list_name": "OFAC",
      "name": "Vladimir Putin",
      "score": 86,
      "source": "OFAC_SDN",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "CSL",
      "name": "Putin Vladimir",
      "score": 86,
      "source": "Specially Designated Nationals (SDN) - Treasury Department",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    }
  ],
  "list_dates": {
    "OFAC": "2026-11-10",
    "UK_OFSI": "2026-11-09",
    "UN_SC": "2026-11-10",
    "CSL": "unknown",
    "EU_FSF": "2026-11-10",
    "CANADA_SEMA": "2026-11-09",
    "AUSTRALIA_DFAT": "2026-11-10"
  },
  "screened_at": "2026-11-10T09:26:21Z"
}
```

#### Empty Responses
```json
{
  "input": "BISHOP, Adam Roy",
  "is_match": false,
  "matches": [],
  "list_dates": {
    "OFAC": "2026-11-10",
    "UK_OFSI": "2026-11-09",
    "UN_SC": "2026-11-10",
    "CSL": "unknown",
    "EU_FSF": "2026-11-10",
    "CANADA_SEMA": "2026-11-09",
    "AUSTRALIA_DFAT": "2026-11-10"
  },
  "screened_at": "2026-11-10T09:27:21Z"
}
```

#### Error Responses
```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": [
        "body",
        "name"
      ],
      "msg": "String should have at least 1 character",
      "input": "",
      "ctx": {
        "min_length": 1
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "greater_than_equal",
      "loc": [
        "body",
        "threshold"
      ],
      "msg": "Input should be greater than or equal to 50",
      "input": -1,
      "ctx": {
        "ge": 50
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "less_than_equal",
      "loc": [
        "body",
        "threshold"
      ],
      "msg": "Input should be less than or equal to 100",
      "input": 99999999,
      "ctx": {
        "le": 100
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": [
        "body",
        "name"
      ],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

```json
{
  "message": "You have exceeded the rate limit per minute for your plan, BASIC, by the API provider"
}
```

