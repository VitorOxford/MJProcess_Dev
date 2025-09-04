// src/api/gestaoClick.ts

// ATENÇÃO: Substitua os valores abaixo pelos seus tokens
const ACCESS_TOKEN = 'a3807c2e6aa5c6bbeface2068fb2a56b766858cd';
const SECRET_ACCESS_TOKEN = 'a10def5158ea23ecd7baf36022ef4b3672d151d4';
// Usando o proxy do Vite para desenvolvimento
const API_BASE_URL = '/api-betel';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'access-token': ACCESS_TOKEN,
  'secret-access-token': SECRET_ACCESS_TOKEN,
});

// Tipagens
type Endereco = { cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade_id?: string; nome_cidade?: string; estado?: string; }
type ClientPayload = { nome: string; tipo_pessoa: 'PF' | 'PJ' | 'ES'; cpf_cnpj?: string; email?: string; telefone?: string; celular?: string; enderecos?: { endereco: Endereco }[]; cpf?: string; cnpj?: string; };
type ClientResponse = { id: number; nome: string; }
type Product = { id: number; nome: string; };
type Service = { id: number; nome: string; };
type SaleStatus = { id: number; nome: string; };
type SalePayload = { cliente_id: number; vendedor_id?: string; data: string; situacao_id: number; produtos: any[]; servicos: any[]; };

const gestaoApi = {
  async cadastrarCliente(clienteData: ClientPayload): Promise<ClientResponse> {
    const payload: Partial<ClientPayload> = {};
    for (const key in clienteData) {
      const value = clienteData[key as keyof ClientPayload];
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (value !== null && value !== '') {
        (payload as any)[key] = value;
      }
    }
    if (payload.cpf_cnpj) {
        if (payload.tipo_pessoa === 'PF') payload.cpf = payload.cpf_cnpj;
        else payload.cnpj = payload.cpf_cnpj;
        delete payload.cpf_cnpj;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/clientes`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const responseData = await response.json();
      if (!response.ok || responseData.status !== 'success') { throw new Error(responseData?.msg || responseData?.erros?.[0] || `Erro ${response.status}`); }
      return responseData.data;
    } catch (error) { console.error('Erro em cadastrarCliente:', error); throw error; }
  },

  async buscarClientes(termo: string): Promise<ClientResponse[]> {
    if (!termo || termo.length < 2) return [];
    try {
       const response = await fetch(`${API_BASE_URL}/clientes?nome=${encodeURIComponent(termo)}`, { headers: getAuthHeaders() });
      if (!response.ok) return [];
      const responseData = await response.json();
      return responseData.data || [];
    } catch (error) { console.error('Erro em buscarClientes:', error); return []; }
  },

  async buscarCidades(estadoId: number): Promise<{id: string, nome: string}[]> {
    try {
       const response = await fetch(`${API_BASE_URL}/cidades?estado_id=${estadoId}`, { headers: getAuthHeaders() });
      if (!response.ok) return [];
      const responseData = await response.json();
      return responseData.data || [];
    } catch (error) { console.error('Erro em buscarCidades:', error); return []; }
  },

  async buscarEstados(): Promise<{id: string, sigla: string}[]> {
     try {
       const response = await fetch(`${API_BASE_URL}/estados`, { headers: getAuthHeaders() });
       if (!response.ok) { throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`); }
      const responseData = await response.json();
      return responseData.data || [];
    } catch (error) { console.error('Erro em buscarEstados:', error); throw error; }
  },

  async getSituacoesVenda(): Promise<SaleStatus[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/situacoes_vendas`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Não foi possível buscar as situações de venda.');
      const data = await response.json();
      return data.data || [];
    } catch (error) { console.error('Erro em getSituacoesVenda:', error); throw error; }
  },

  async findOrCreateProduto(nomeProduto: string): Promise<Product> {
    try {
      const responseGet = await fetch(`${API_BASE_URL}/produtos?nome=${encodeURIComponent(nomeProduto)}`, { headers: getAuthHeaders() });
      const dataGet = await responseGet.json();
      if (dataGet.data && dataGet.data.length > 0) { return dataGet.data[0]; }

      const payload = { nome: nomeProduto, codigo_interno: `TEC-${Date.now()}`, valor_custo: 0 };
      const responsePost = await fetch(`${API_BASE_URL}/produtos`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const dataPost = await responsePost.json();
      if (!responsePost.ok || dataPost.status !== 'success') { throw new Error(dataPost?.msg || 'Erro ao cadastrar novo produto na API externa.'); }
      return dataPost.data;
    } catch (error) { console.error(`Erro em findOrCreateProduto para "${nomeProduto}":`, error); throw error; }
  },

  async findOrCreateServico(nomeServico: string): Promise<Service> {
    try {
      const responseGet = await fetch(`${API_BASE_URL}/servicos?nome=${encodeURIComponent(nomeServico)}`, { headers: getAuthHeaders() });
      const dataGet = await responseGet.json();
      if (dataGet.data && dataGet.data.length > 0) { return dataGet.data[0]; }

      const payload = { nome: nomeServico, codigo: `EST-${Date.now()}` };
      const responsePost = await fetch(`${API_BASE_URL}/servicos`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const dataPost = await responsePost.json();
       if (!responsePost.ok || dataPost.status !== 'success') { throw new Error(dataPost?.msg || 'Erro ao cadastrar novo serviço na API externa.'); }
      return dataPost.data;
    } catch (error) { console.error(`Erro em findOrCreateServico para "${nomeServico}":`, error); throw error; }
  },

  async cadastrarVenda(vendaData: SalePayload): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/vendas`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(vendaData) });
      const responseData = await response.json();
      if (!response.ok || responseData.status !== 'success') { throw new Error(responseData?.msg || 'Erro ao cadastrar a venda na API externa.'); }
      return responseData.data;
    } catch (error) { console.error('Erro em cadastrarVenda:', error); throw error; }
  }
};

export { gestaoApi };
