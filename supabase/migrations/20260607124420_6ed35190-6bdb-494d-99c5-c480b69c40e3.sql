
-- Atualiza slugs InfoSimples e adiciona PGE-RS para o sistema Solv Construtora
UPDATE public.certificate_types SET provider_service_key='pref/rs/sao-borja/cnd', automatic_enabled=true, provider='infosimples' WHERE code='cnd-municipal-saoborja';
UPDATE public.certificate_types SET provider_service_key='sefaz/rs/certidao-negativa', automatic_enabled=true, provider='infosimples' WHERE code='sefaz-rs';
UPDATE public.certificate_types SET provider_service_key='tj/rs/certidao-negativa-falencia', automatic_enabled=true, provider='infosimples' WHERE code='tjrs-judicial';
UPDATE public.certificate_types SET provider_service_key='trf4/certidao-negativa', automatic_enabled=true, provider='infosimples' WHERE code='trf4-judicial';
UPDATE public.certificate_types SET provider_service_key='receita-federal/certidao-negativa', automatic_enabled=true, provider='infosimples' WHERE code='cnd-federal';
UPDATE public.certificate_types SET provider_service_key='caixa/regularidade', automatic_enabled=true, provider='infosimples' WHERE code='crf-fgts';
UPDATE public.certificate_types SET provider_service_key='tst/certidao-negativa', automatic_enabled=true, provider='infosimples' WHERE code='cndt';

INSERT INTO public.certificate_types (code,name,short_name,category,scope,state,issuing_authority,provider,provider_service_key,automatic_enabled,manual_upload_enabled,active,description,display_order)
VALUES ('pge-rs','Certidão Negativa PGE-RS','PGE-RS','fiscal','state','RS','Procuradoria Geral do Estado RS','infosimples','pge/rs/certidao-negativa',true,true,true,'Dívida ativa estadual',25)
ON CONFLICT (code) DO UPDATE SET provider_service_key=EXCLUDED.provider_service_key, automatic_enabled=true, provider='infosimples';
