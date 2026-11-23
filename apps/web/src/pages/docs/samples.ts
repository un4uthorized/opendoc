/* Request snippets built from a concrete request, one per language most API consumers use:
   cURL, HTTPie, PowerShell, JavaScript, Node.js, Python, Go, Java, C#, PHP, Ruby, Kotlin, Swift,
   Rust, Dart, Elixir, C, C++, Scala and R.
   Each uses the standard library or the de facto HTTP client of its ecosystem, sends the body as
   written (JSON, form, multipart, XML or text) and reads credentials from an environment variable
   (never inlined). Multipart samples are only generated where the language's client has a real
   form-data API in a few lines (cURL, HTTPie, JavaScript, Node.js, Python); a binary file body, where
   sending a file as is takes one line (those and PowerShell). */

/** Where the credential goes: a header (value = prefix + secret) or a query parameter. */
export interface SampleAuth { header?: string; query?: string; prefix?: string; env: string }

export type SampleBody =
  | { kind: 'json' | 'text'; contentType: string; text: string }
  | { kind: 'form'; contentType: string; fields: Array<[string, string]> }
  | { kind: 'multipart'; contentType: string; fields: Array<{ name: string; value: string; file?: boolean }> }
  /** The raw contents of a file (Postman's "binary"). */
  | { kind: 'file'; contentType: string; fileName: string };

export interface SampleRequest {
  method: string;
  url: string;
  /** Plain headers (credentials go in `auth`; Content-Type comes from the body). */
  headers: Array<[string, string]>;
  auth?: SampleAuth;
  body?: SampleBody;
}

/** What each generator gets: the URL with any query credential, headers with Content-Type, and a text body
    for form data in languages that just send the encoded string. */
interface Req {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  auth?: { header: string; prefix: string; env: string };
  /** JSON or text body. */
  text?: { json: boolean; contentType: string; value: string };
  form?: Array<[string, string]>;
  multipart?: Array<{ name: string; value: string; file?: boolean }>;
  /** Binary body: the file sent as is. */
  file?: { name: string; contentType: string };
}

const indent = (text: string, prefix: string) => text.split('\n').map((line) => (line ? prefix + line : line)).join('\n');
const pascal = (method: string) => method.charAt(0) + method.slice(1).toLowerCase();
const isContentType = (key: string) => key.toLowerCase() === 'content-type';
const fileName = (field: string) => `${field}.pdf`;

/** Shell quoting: double quotes when the value reads an environment variable ($API_KEY), single otherwise. */
const shellQuote = (text: string) => (text.includes('$') ? `"${text}"` : `'${text}'`);
/** A URL with a {ENV_NAME} credential placeholder, as a shell reads it ($ENV_NAME, double-quoted). */
const shellUrl = (url: string) => shellQuote(url.replace(/\{([A-Z][A-Z0-9_]*)\}/g, '$$$1'));
const urlencoded = (fields: Array<[string, string]>) => new URLSearchParams(fields).toString();

/* ── Shells ────────────────────────────────────────────────────────── */

function curl({ method, url, headers, auth, text, form, multipart, file }: Req) {
  return [
    `curl${method === 'GET' ? '' : ` -X ${method}`} ${shellUrl(url)}`,
    ...(auth ? [`  -H "${auth.header}: ${auth.prefix}$${auth.env}"`] : []),
    ...headers.filter(([key]) => !(multipart && isContentType(key))).map(([key, value]) => `  -H ${shellQuote(`${key}: ${value}`)}`),
    ...(text ? [`  -d '${text.value.replace(/\n/g, '\n  ')}'`] : []),
    ...(form ?? []).map(([name, value]) => `  --data-urlencode '${name}=${value}'`),
    ...(multipart ?? []).map((field) => (field.file ? `  -F '${field.name}=@${fileName(field.name)}'` : `  -F '${field.name}=${field.value}'`)),
    ...(file ? [`  --data-binary '@${file.name}'`] : []),
  ].join(' \\\n');
}

function httpie({ method, url, headers, auth, text, form, multipart, file }: Req) {
  return [
    `http${form ? ' --form' : multipart ? ' --multipart' : ''} ${method} ${shellUrl(url)}`,
    ...(auth ? [`  "${auth.header}:${auth.prefix}$${auth.env}"`] : []),
    ...headers.filter(([key]) => !((form || multipart) && isContentType(key))).map(([key, value]) => `  ${shellQuote(`${key}:${value}`)}`),
    ...(text ? [`  --raw '${text.value.replace(/\n/g, '\n  ')}'`] : []),
    ...(form ?? []).map(([name, value]) => `  '${name}=${value}'`),
    ...(multipart ?? []).map((field) => (field.file ? `  '${field.name}@${fileName(field.name)}'` : `  '${field.name}=${field.value}'`)),
  ].join(' \\\n') + (file ? ` < '${file.name}'` : '');
}

function powershell({ method, url, headers, auth, text, file }: Req) {
  // -ContentType sets Content-Type; the rest go in -Headers.
  const rest = headers.filter(([key]) => !isContentType(key));
  const lines = [
    ...(auth ? [`  "${auth.header}" = "${auth.prefix}$env:${auth.env}"`] : []),
    ...rest.map(([key, value]) => `  "${key}" = "${value}"`),
  ];
  return [
    ...(lines.length ? ['$headers = @{', ...lines, '}'] : []),
    ...(text ? ["$body = @'", text.value, "'@"] : []),
    ...(lines.length || text ? [''] : []),
    [
      `$response = Invoke-RestMethod -Uri ${/\{[A-Z][A-Z0-9_]*\}/.test(url) ? `"${url.replace(/\{([A-Z][A-Z0-9_]*)\}/g, '$$env:$1')}"` : `'${url}'`} -Method ${pascal(method)}`,
      ...(lines.length ? ['-Headers $headers'] : []),
      ...(text ? [`-ContentType '${text.contentType}' -Body $body`] : []),
      ...(file ? [`-ContentType '${file.contentType}' -InFile '${file.name}'`] : []),
    ].join(' '),
    '$response | ConvertTo-Json -Depth 10',
  ].join('\n');
}

/* ── JavaScript ────────────────────────────────────────────────────── */

const jsKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`);
const jsString = (value: string) => `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;

function jsHeaderLines({ headers, auth, multipart }: Req) {
  return [
    ...(auth ? [`    ${jsKey(auth.header)}: \`${auth.prefix}\${process.env.${auth.env}}\`,`] : []),
    // FormData sets its own Content-Type (with the boundary).
    ...headers.filter(([key]) => !(multipart && isContentType(key))).map(([key, value]) => `    ${jsKey(key)}: '${value}',`),
  ];
}

function javascript(req: Req) {
  const { method, url, text, form, multipart, file } = req;
  const lines = jsHeaderLines(req);
  return [
    ...(multipart ? [
      '// The file comes from an <input type="file">.',
      'const form = new FormData();',
      ...multipart.map((field) => (field.file ? `form.append('${field.name}', fileInput.files[0]);` : `form.append('${field.name}', '${field.value}');`)),
      '',
    ] : []),
    `const response = await fetch('${url}', {`,
    `  method: '${method}',`,
    ...(lines.length ? ['  headers: {', ...lines, '  },'] : []),
    ...(text ? [text.json ? `  body: JSON.stringify(${text.value.replace(/\n/g, '\n  ')}),` : `  body: ${jsString(text.value)},`] : []),
    ...(form ? [`  body: new URLSearchParams(${JSON.stringify(Object.fromEntries(form))}),`] : []),
    ...(multipart ? ['  body: form,'] : []),
    ...(file ? ['  body: fileInput.files[0], // from an <input type="file">'] : []),
    '});',
    method === 'DELETE' ? 'console.log(response.status);' : text?.json || !text ? 'const data = await response.json();' : 'const data = await response.text();',
  ].join('\n');
}

function node(req: Req) {
  const { method, url, text, form, multipart, file } = req;
  const lines = jsHeaderLines(req);
  return [
    "import axios from 'axios';",
    ...(multipart?.some((field) => field.file) ? ["import { openAsBlob } from 'node:fs';"] : []),
    ...(file ? ["import { readFile } from 'node:fs/promises';"] : []),
    '',
    ...(multipart ? [
      'const form = new FormData();',
      ...multipart.map((field) => (field.file ? `form.append('${field.name}', await openAsBlob('${fileName(field.name)}'), '${fileName(field.name)}');` : `form.append('${field.name}', '${field.value}');`)),
      '',
    ] : []),
    'const response = await axios.request({',
    `  method: '${method.toLowerCase()}',`,
    `  url: '${url}',`,
    ...(lines.length ? ['  headers: {', ...lines, '  },'] : []),
    ...(text ? [text.json ? `  data: ${text.value.replace(/\n/g, '\n  ')},` : `  data: ${jsString(text.value)},`] : []),
    ...(form ? [`  data: new URLSearchParams(${JSON.stringify(Object.fromEntries(form))}),`] : []),
    ...(multipart ? ['  data: form,'] : []),
    ...(file ? [`  data: await readFile('${file.name}'),`] : []),
    '});',
    'console.log(response.status, response.data);',
  ].join('\n');
}

/* ── Python ────────────────────────────────────────────────────────── */

function python({ method, url, headers, auth, text, form, multipart, file }: Req) {
  const lines = [
    ...(auth ? [`"${auth.header}": f"${auth.prefix}{os.environ['${auth.env}']}"`] : []),
    ...headers.filter(([key]) => !((text?.json || form || multipart) && isContentType(key))).map(([key, value]) => `"${key}": "${value}"`),
  ];
  const json = text?.json ? text.value.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None') : undefined;
  const files = multipart?.filter((field) => field.file) ?? [];
  const data = form ?? multipart?.filter((field) => !field.file).map((field) => [field.name, field.value] as [string, string]);
  return [
    auth ? 'import os, requests' : 'import requests',
    '',
    `response = requests.${method.toLowerCase()}(`,
    `    "${url}",`,
    ...(lines.length ? [`    headers={${lines.join(', ')}},`] : []),
    ...(json ? [`    json=${json.replace(/\n/g, '\n    ')},`] : []),
    ...(text && !text.json ? [`    data="""${text.value}""",`] : []),
    ...(data?.length ? [`    data={${data.map(([name, value]) => `"${name}": "${value}"`).join(', ')}},`] : []),
    ...(files.length ? [`    files={${files.map((field) => `"${field.name}": open("${fileName(field.name)}", "rb")`).join(', ')}},`] : []),
    ...(file ? [`    data=open("${file.name}", "rb"),`] : []),
    ')',
    method === 'DELETE' ? 'print(response.status_code)' : text?.json || !text ? 'data = response.json()' : 'data = response.text',
  ].join('\n');
}

/* ── Compiled and other languages (JSON or text bodies) ────────────── */

function go({ method, url, headers, auth, text }: Req) {
  const imports = ['fmt', 'io', 'net/http', ...(auth ? ['os'] : []), ...(text ? ['strings'] : [])];
  return [
    'package main',
    '',
    'import (',
    ...imports.map((name) => `\t"${name}"`),
    ')',
    '',
    'func main() {',
    ...(text ? [`\tbody := strings.NewReader(\`${text.value.replace(/\n/g, '\n\t')}\`)`, `\treq, _ := http.NewRequest("${method}", "${url}", body)`] : [`\treq, _ := http.NewRequest("${method}", "${url}", nil)`]),
    ...(auth ? [`\treq.Header.Set("${auth.header}", "${auth.prefix}"+os.Getenv("${auth.env}"))`] : []),
    ...headers.map(([key, value]) => `\treq.Header.Set("${key}", "${value}")`),
    '',
    '\tres, err := http.DefaultClient.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer res.Body.Close()',
    '',
    '\tdata, _ := io.ReadAll(res.Body)',
    '\tfmt.Println(res.StatusCode, string(data))',
    '}',
  ].join('\n');
}

function java({ method, url, headers, auth, text }: Req) {
  const send = text
    ? [`    .method("${method}", HttpRequest.BodyPublishers.ofString("""`, indent(text.value, '        '), '        """))']
    : [method === 'GET' ? '    .GET()' : method === 'DELETE' ? '    .DELETE()' : `    .method("${method}", HttpRequest.BodyPublishers.noBody())`];
  return [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    `var request = HttpRequest.newBuilder(URI.create("${url}"))`,
    ...(auth ? [`    .header("${auth.header}", "${auth.prefix}" + System.getenv("${auth.env}"))`] : []),
    ...headers.map(([key, value]) => `    .header("${key}", "${value}")`),
    ...send,
    '    .build();',
    '',
    'var response = HttpClient.newHttpClient()',
    '    .send(request, HttpResponse.BodyHandlers.ofString());',
    'System.out.println(response.statusCode() + " " + response.body());',
  ].join('\n');
}

function csharp({ method, url, headers, auth, text }: Req) {
  return [
    ...(text ? ['using System.Text;', ''] : []),
    'using var client = new HttpClient();',
    `var request = new HttpRequestMessage(HttpMethod.${pascal(method)}, "${url}");`,
    ...(auth ? [`request.Headers.Add("${auth.header}", $"${auth.prefix}{Environment.GetEnvironmentVariable("${auth.env}")}");`] : []),
    // Content-Type belongs to the content (StringContent sets it), not to the request headers.
    ...headers.filter(([key]) => !isContentType(key)).map(([key, value]) => `request.Headers.Add("${key}", "${value}");`),
    ...(text ? ['request.Content = new StringContent("""', indent(text.value, '    '), `    """, Encoding.UTF8, "${text.contentType}");`] : []),
    '',
    'var response = await client.SendAsync(request);',
    'Console.WriteLine(await response.Content.ReadAsStringAsync());',
  ].join('\n');
}

function php({ method, url, headers, auth, text }: Req) {
  const headerLines = [
    ...(auth ? [`        '${auth.header}' => '${auth.prefix}' . getenv('${auth.env}'),`] : []),
    ...headers.map(([key, value]) => `        '${key}' => '${value}',`),
  ];
  const options = [
    ...(headerLines.length ? ["    'headers' => [", ...headerLines, '    ],'] : []),
    ...(text ? ["    'body' => <<<'BODY'", indent(text.value, '    '), '    BODY,'] : []),
  ];
  return [
    '<?php',
    "require 'vendor/autoload.php';",
    '',
    '$client = new GuzzleHttp\\Client();',
    options.length ? `$response = $client->request('${method}', '${url}', [` : `$response = $client->request('${method}', '${url}');`,
    ...(options.length ? [...options, ']);'] : []),
    '',
    'echo $response->getStatusCode(), PHP_EOL, $response->getBody();',
  ].join('\n');
}

function ruby({ method, url, headers, auth, text }: Req) {
  return [
    'require "net/http"',
    '',
    `uri = URI("${url}")`,
    `request = Net::HTTP::${pascal(method)}.new(uri)`,
    ...(auth ? [`request["${auth.header}"] = "${auth.prefix}#{ENV.fetch("${auth.env}")}"`] : []),
    ...headers.map(([key, value]) => `request["${key}"] = "${value}"`),
    ...(text ? ['request.body = <<~BODY', indent(text.value, '  '), 'BODY'] : []),
    '',
    'response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(request) }',
    'puts response.code, response.body',
  ].join('\n');
}

function kotlin({ method, url, headers, auth, text }: Req) {
  const call = text ? `.${method.toLowerCase()}(body)` : method === 'GET' ? '.get()' : method === 'DELETE' ? '.delete()' : `.method("${method}", null)`;
  return [
    ...(text ? ['import okhttp3.MediaType.Companion.toMediaType'] : []),
    'import okhttp3.OkHttpClient',
    'import okhttp3.Request',
    ...(text ? ['import okhttp3.RequestBody.Companion.toRequestBody'] : []),
    '',
    ...(text ? ['val body = """', indent(text.value, '    '), `""".trimIndent().toRequestBody("${text.contentType}".toMediaType())`, ''] : []),
    'val request = Request.Builder()',
    `    .url("${url}")`,
    ...(auth ? [`    .header("${auth.header}", "${auth.prefix}\${System.getenv("${auth.env}")}")`] : []),
    // The request body already carries its media type.
    ...headers.filter(([key]) => !isContentType(key)).map(([key, value]) => `    .header("${key}", "${value}")`),
    `    ${call}`,
    '    .build()',
    '',
    'OkHttpClient().newCall(request).execute().use { response ->',
    '    println("${response.code} ${response.body?.string()}")',
    '}',
  ].join('\n');
}

function swift({ method, url, headers, auth, text }: Req) {
  return [
    'import Foundation',
    '',
    `var request = URLRequest(url: URL(string: "${url}")!)`,
    ...(method === 'GET' ? [] : [`request.httpMethod = "${method}"`]),
    ...(auth ? [`request.setValue("${auth.prefix}\\(ProcessInfo.processInfo.environment["${auth.env}"] ?? "")", forHTTPHeaderField: "${auth.header}")`] : []),
    ...headers.map(([key, value]) => `request.setValue("${value}", forHTTPHeaderField: "${key}")`),
    ...(text ? ['request.httpBody = """', indent(text.value, '    '), '    """.data(using: .utf8)'] : []),
    '',
    'let (data, response) = try await URLSession.shared.data(for: request)',
    'print((response as? HTTPURLResponse)?.statusCode ?? 0, String(decoding: data, as: UTF8.self))',
  ].join('\n');
}

function rust({ method, url, headers, auth, text }: Req) {
  return [
    ...(text?.json ? ['use serde_json::json;', ''] : []),
    'let client = reqwest::Client::new();',
    'let response = client',
    `    .${method.toLowerCase()}("${url}")`,
    ...(auth ? [`    .header("${auth.header}", format!("${auth.prefix}{}", std::env::var("${auth.env}")?))`] : []),
    // .json() sets Content-Type itself.
    ...headers.filter(([key]) => !(text?.json && isContentType(key))).map(([key, value]) => `    .header("${key}", "${value}")`),
    ...(text?.json ? [`    .json(&json!(${text.value.replace(/\n/g, '\n    ')}))`] : []),
    ...(text && !text.json ? [`    .body(r#"${text.value}"#)`] : []),
    '    .send()',
    '    .await?;',
    '',
    'println!("{} {}", response.status(), response.text().await?);',
  ].join('\n');
}

function dart({ method, url, headers, auth, text }: Req) {
  const lines = [
    ...(auth ? [`      '${auth.header}': '${auth.prefix}\${Platform.environment['${auth.env}']}',`] : []),
    ...headers.map(([key, value]) => `      '${key}': '${value}',`),
  ];
  return [
    ...(auth ? ["import 'dart:io';", ''] : []),
    "import 'package:http/http.dart' as http;",
    '',
    'void main() async {',
    `  final response = await http.${method.toLowerCase()}(`,
    `    Uri.parse('${url}'),`,
    ...(lines.length ? ['    headers: {', ...lines, '    },'] : []),
    ...(text ? ["    body: '''", indent(text.value, '    '), "    ''',"] : []),
    '  );',
    "  print('${response.statusCode} ${response.body}');",
    '}',
  ].join('\n');
}

function elixir({ method, url, headers, auth, text }: Req) {
  const list = [
    ...(auth ? [`{"${auth.header.toLowerCase()}", "${auth.prefix}#{System.fetch_env!("${auth.env}")}"}`] : []),
    ...headers.map(([key, value]) => `{"${key.toLowerCase()}", "${value}"}`),
  ];
  return [
    'Mix.install([{:req, "~> 0.5"}])',
    '',
    'response =',
    '  Req.request!(',
    `    method: :${method.toLowerCase()},`,
    `    url: "${url}"${list.length || text ? ',' : ''}`,
    ...(list.length ? [`    headers: [${list.join(', ')}]${text ? ',' : ''}`] : []),
    ...(text ? ['    body: ~S"""', indent(text.value, '    '), '    """'] : []),
    '  )',
    '',
    'IO.inspect({response.status, response.body})',
  ].join('\n');
}

/** A text as adjacent C string literals, one per line. */
const cString = (value: string, prefix: string) => value.split('\n')
  .map((line, index, all) => `${prefix}"${line.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}${index < all.length - 1 ? '\\n' : ''}"`)
  .join('\n');

function c({ method, url, headers, auth, text }: Req) {
  return [
    '#include <curl/curl.h>',
    ...(auth ? ['#include <stdio.h>', '#include <stdlib.h>'] : []),
    '',
    'int main(void) {',
    '  CURL *curl = curl_easy_init();',
    '  struct curl_slist *headers = NULL;',
    ...(auth ? ['  char auth[512];', `  snprintf(auth, sizeof auth, "${auth.header}: ${auth.prefix}%s", getenv("${auth.env}"));`, '  headers = curl_slist_append(headers, auth);'] : []),
    ...headers.map(([key, value]) => `  headers = curl_slist_append(headers, "${key}: ${value}");`),
    '',
    `  curl_easy_setopt(curl, CURLOPT_URL, "${url}");`,
    ...(method === 'GET' ? [] : [`  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${method}");`]),
    ...(headers.length || auth ? ['  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);'] : []),
    ...(text ? ['  curl_easy_setopt(curl, CURLOPT_POSTFIELDS,', `${cString(text.value, '    ')});`] : []),
    '',
    '  CURLcode result = curl_easy_perform(curl); /* prints the response body */',
    '',
    '  curl_slist_free_all(headers);',
    '  curl_easy_cleanup(curl);',
    '  return result == CURLE_OK ? 0 : 1;',
    '}',
  ].join('\n');
}

function cpp({ method, url, headers, auth, text }: Req) {
  const list = [
    ...(auth ? [`{"${auth.header}", std::string("${auth.prefix}") + std::getenv("${auth.env}")}`] : []),
    ...headers.map(([key, value]) => `{"${key}", "${value}"}`),
  ];
  const args = [
    `cpr::Url{"${url}"}`,
    ...(list.length ? [`cpr::Header{${list.join(', ')}}`] : []),
    ...(text ? [`cpr::Body{R"(${text.value})"}`] : []),
  ];
  return [
    '#include <cpr/cpr.h>',
    ...(auth ? ['#include <cstdlib>'] : []),
    '#include <iostream>',
    '',
    'int main() {',
    `  cpr::Response response = cpr::${pascal(method)}(`,
    `${indent(args.join(',\n'), '      ')});`,
    '  std::cout << response.status_code << " " << response.text << std::endl;',
    '}',
  ].join('\n');
}

function scala({ method, url, headers, auth, text }: Req) {
  return [
    'import sttp.client4.quick.*',
    '',
    'val response = quickRequest',
    `  .${method.toLowerCase()}(uri"${url}")`,
    ...(auth ? [`  .header("${auth.header}", s"${auth.prefix}\${sys.env("${auth.env}")}")`] : []),
    ...headers.map(([key, value]) => `  .header("${key}", "${value}")`),
    ...(text ? [`  .body("""${text.value.split('\n').map((line, index) => (index === 0 ? line : `    |${line}`)).join('\n')}""".stripMargin)`] : []),
    '  .send()',
    '',
    'println(s"${response.code} ${response.body}")',
  ].join('\n');
}

function r({ method, url, headers, auth, text }: Req) {
  // req_body_raw() sets Content-Type; other headers need backticks when the name isn't a plain identifier.
  const rest = headers.filter(([key]) => !(text && isContentType(key)));
  const name = (key: string) => (/^[A-Za-z][\w.]*$/.test(key) ? key : `\`${key}\``);
  const pairs = [
    ...(auth ? [`${name(auth.header)} = paste0("${auth.prefix}", Sys.getenv("${auth.env}"))`] : []),
    ...rest.map(([key, value]) => `${name(key)} = "${value}"`),
  ];
  return [
    'library(httr2)',
    '',
    `response <- request("${url}") |>`,
    `  req_method("${method}") |>`,
    ...(pairs.length ? [`  req_headers(${pairs.join(', ')}) |>`] : []),
    ...(text ? [`  req_body_raw('${text.value.replace(/\n/g, '\n  ')}', type = "${text.contentType}") |>`] : []),
    '  req_perform()',
    '',
    'resp_status(response)',
    'resp_body_string(response)',
  ].join('\n');
}

/**
 * `language` is the remembered choice; `syntax` the highlighter id when it differs (HTTPie is a
 * shell command, Node.js is JavaScript); `label` the name in the picker when the id isn't enough.
 * `bash` is shown as "cURL".
 */
export interface Sample { language: string; code: string; label?: string; syntax?: string }

type Generator = (req: Req) => string;
/** [language, generator, handles form data natively, handles multipart, label, syntax] */
const languages: Array<[string, Generator, boolean, boolean, string?, string?]> = [
  ['bash', curl, true, true],
  ['httpie', httpie, true, true, 'HTTPie', 'bash'],
  ['powershell', powershell, false, false],
  ['javascript', javascript, true, true],
  ['node', node, true, true, 'Node.js (axios)', 'javascript'],
  ['python', python, true, true],
  ['go', go, false, false],
  ['java', java, false, false],
  ['csharp', csharp, false, false],
  ['php', php, false, false],
  ['ruby', ruby, false, false],
  ['kotlin', kotlin, false, false],
  ['swift', swift, false, false],
  ['rust', rust, false, false],
  ['dart', dart, false, false],
  ['elixir', elixir, false, false],
  ['c', c, false, false],
  ['cpp', cpp, false, false],
  ['scala', scala, false, false],
  ['r', r, false, false],
];

/** Languages whose sample sends a file as the raw body in a line or two. */
const fileLanguages = new Set(['bash', 'httpie', 'powershell', 'javascript', 'node', 'python']);

export function buildSamples({ method, url, headers, auth, body }: SampleRequest): Sample[] {
  // A query credential is a placeholder in the URL ({ENV_NAME}); it is never the real value.
  const fullUrl = auth?.query ? `${url}${url.includes('?') ? '&' : '?'}${auth.query}={${auth.env}}` : url;
  const headerAuth = auth?.header ? { header: auth.header, prefix: auth.prefix ?? '', env: auth.env } : undefined;
  const withType = (contentType: string): Array<[string, string]> => (headers.some(([key]) => isContentType(key)) ? headers : [...headers, ['Content-Type', contentType]]);
  const base = { method, url: fullUrl, headers, auth: headerAuth };
  return languages.flatMap(([language, generate, nativeForm, nativeMultipart, label, syntax]) => {
    let req: Req = base;
    if (body?.kind === 'json' || body?.kind === 'text') req = { ...base, headers: withType(body.contentType), text: { json: body.kind === 'json', contentType: body.contentType, value: body.text } };
    if (body?.kind === 'form') {
      req = nativeForm
        ? { ...base, headers: withType(body.contentType), form: body.fields }
        : { ...base, headers: withType(body.contentType), text: { json: false, contentType: body.contentType, value: urlencoded(body.fields) } };
    }
    if (body?.kind === 'multipart') {
      if (!nativeMultipart) return [];
      req = { ...base, multipart: body.fields };
    }
    if (body?.kind === 'file') {
      if (!fileLanguages.has(language)) return [];
      req = { ...base, headers: withType(body.contentType), file: { name: body.fileName, contentType: body.contentType } };
    }
    return [{ language, code: generate(req), ...(label ? { label } : {}), ...(syntax ? { syntax } : {}) }];
  });
}
