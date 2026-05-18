import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, modo, ref, nfeData } = await req.json();

    if (!token) {
      throw new Error('Token da Focus NFe não fornecido.');
    }

    if (!ref) {
      throw new Error('Referência (ref) não fornecida.');
    }

    // --- SIMULAÇÃO PARA A PROVA DE CONCEITO (PoC) ---
    // Como sou uma IA e não possuo conta na Focus NFe, criei este bypass
    // para que o fluxo do sistema possa ser validado sem um token real.
    if (token === 'TOKEN_POC_TRAE_123') {
      console.log(`[SIMULAÇÃO] Emitindo NFSe fake para Ref: ${ref}`);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            status: "autorizado",
            numero: Math.floor(Math.random() * 1000).toString(),
            codigo_verificacao: "AB12CD34",
            data_emissao: new Date().toISOString(),
            url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", // Um PDF de teste real e público
            caminho_xml_nota_fiscal: "/exemplo_nota.xml",
            cnpj_prestador: nfeData?.prestador?.cnpj || "00000000000000"
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    // ------------------------------------------------

    // Define Base URL according to mode
    const isHomologacao = String(modo || '').toUpperCase() === 'HOMOLOGACAO';
    const baseUrl = isHomologacao 
      ? 'https://homologacao.focusnfe.com.br/v2/nfse' 
      : 'https://api.focusnfe.com.br/v2/nfse';

    const endpoint = `${baseUrl}?ref=${encodeURIComponent(ref)}`;

    // Encode token for Basic Auth
    const base64Token = btoa(`${token}:`);

    console.log(`Enviando NFSe para Focus NFe (${isHomologacao ? 'Homologação' : 'Produção'}). Ref: ${ref}`);

    // Call Focus NFe API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nfeData)
    });

    const responseText = await response.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      responseJson = { error: 'Invalid JSON response from Focus NFe', raw: responseText };
    }

    console.log(`Resposta Focus NFe (Status ${response.status}):`, responseJson);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: responseJson.mensagem || responseJson.codigo || 'Erro na comunicação com a Focus NFe',
          details: responseJson.erros || responseJson
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        data: responseJson
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro interno na Edge Function focus-nfe-api:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});