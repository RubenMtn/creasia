const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const updates = {
  es: {
    sociosCaption: 'Regístrate con tu email y la contraseña que elijas (mínimo 8 caracteres e incluye un número) para obtener todos los beneficios que proporciona nuestra asociación: información exclusiva, descuentos, invitaciones a eventos y mucho más...',
    headerLegal: 'Aviso legal',
    menuLegal: 'Legal',
    legal: {
      title: 'Aviso legal',
      section1: {
        title: '1. Información General',
        body: 'Creasia es una entidad dedicada a la organización de actividades culturales, viajes, formación y consultoría entre España y China. El acceso y uso de este sitio web implica la aceptación de las presentes condiciones legales.'
      },
      section2: {
        title: '2. Protección de Datos Personales',
        body1: 'Los datos personales facilitados a través de los formularios de Creasia serán tratados de acuerdo con la normativa vigente en materia de protección de datos (Reglamento UE 2016/679 y Ley Orgánica 3/2018).',
        body2: 'La finalidad del tratamiento es la gestión de la relación con los usuarios, el envío de información sobre actividades, novedades y servicios de Creasia, así como la atención de consultas. Los datos no serán cedidos a terceros salvo obligación legal.',
        body3Before: 'El usuario puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad mediante la sección ',
        contactLink: 'Contáctanos',
        body3After: '.',
        body4: 'Si desea darse de baja de nuestras comunicaciones, también puede solicitarlo a través de la misma página de contacto.'
      },
      section3: {
        title: '3. Exención de Responsabilidad sobre Viajes y Actividades',
        body1: 'Creasia actúa como intermediario en la organización de viajes y actividades culturales, colaborando con proveedores externos. No se responsabiliza de posibles incidencias, retrasos, cancelaciones, cambios de itinerario, accidentes, pérdidas o daños que puedan producirse durante la realización de los viajes o actividades.',
        body2: 'Los participantes son responsables de cumplir con los requisitos legales y sanitarios necesarios para viajar, así como de contratar los seguros pertinentes.'
      },
      section4: {
        title: '4. Contenidos y Propiedad Intelectual',
        body1: 'Todos los contenidos de este sitio web, incluyendo textos, imágenes, logotipos y diseños, son propiedad de Creasia o de sus respectivos titulares y están protegidos por la legislación de propiedad intelectual.',
        body2: 'Queda prohibida la reproducción, distribución o comunicación pública de los contenidos sin autorización expresa.'
      },
      section5: {
        title: '5. Enlaces Externos',
        body1: 'Este sitio web puede contener enlaces a páginas externas. Creasia no se responsabiliza del contenido, exactitud o funcionamiento de dichas páginas, ni de los posibles daños que puedan derivarse del acceso a las mismas.'
      },
      section6: {
        title: '6. Actualización y Modificación',
        body1: 'Creasia se reserva el derecho de modificar, actualizar o eliminar cualquier información contenida en este sitio web, así como la presente política legal, en cualquier momento y sin previo aviso.'
      },
      section7: {
        title: '7. Legislación Aplicable y Jurisdicción',
        body1: 'Las presentes condiciones legales se rigen por la legislación española. Para cualquier controversia derivada del acceso o uso de este sitio web, las partes se someten a los Juzgados y Tribunales de Madrid, salvo que la ley disponga lo contrario.'
      }
    }
  },
  en: {
    headerLegal: 'Legal Notice',
    menuLegal: 'Legal Notice',
    legal: {
      title: 'Legal Notice',
      section1: {
        title: '1. General Information',
        body: 'Creasia is an organisation dedicated to the organisation of cultural activities, trips, training and consulting between Spain and China. Access to and use of this website implies acceptance of these legal conditions.'
      },
      section2: {
        title: '2. Protection of Personal Data',
        body1: 'The personal data provided through Creasia forms will be processed in accordance with current data protection regulations (EU Regulation 2016/679 and Spanish Organic Law 3/2018).',
        body2: 'The purpose of the processing is to manage the relationship with users, to send information about Creasia activities, news and services, and to respond to enquiries. Data will not be shared with third parties unless required by law.',
        body3Before: 'You can exercise your rights of access, rectification, erasure, restriction, objection and portability through the ',
        contactLink: 'Contact us',
        body3After: ' section.',
        body4: 'If you wish to unsubscribe from our communications, you can request it through the same contact page.'
      },
      section3: {
        title: '3. Liability for Trips and Activities',
        body1: 'Creasia acts as an intermediary in the organisation of trips and cultural activities, collaborating with external providers. It is not responsible for possible incidents, delays, cancellations, itinerary changes, accidents, losses or damages that may occur during the trips or activities.',
        body2: 'Participants are responsible for complying with the legal and health requirements necessary for travel, as well as for taking out the relevant insurance.'
      },
      section4: {
        title: '4. Content and Intellectual Property',
        body1: 'All content on this website, including texts, images, logos and designs, belongs to Creasia or to their respective owners and is protected by intellectual property law.',
        body2: 'Reproduction, distribution or public communication of the content without express authorisation is prohibited.'
      },
      section5: {
        title: '5. External Links',
        body1: 'This website may contain links to external pages. Creasia is not responsible for the content, accuracy or operation of these pages, nor for any damage that may arise from accessing them.'
      },
      section6: {
        title: '6. Updates and Modifications',
        body1: 'Creasia reserves the right to modify, update or delete any information contained on this website, as well as this legal policy, at any time and without prior notice.'
      },
      section7: {
        title: '7. Applicable Law and Jurisdiction',
        body1: 'These legal conditions are governed by Spanish law. For any dispute arising from access to or use of this website, the parties submit to the Courts of Madrid, unless otherwise provided by law.'
      }
    }
  },
  zh: {
    headerLegal: '法律声明',
    menuLegal: '法律声明',
    legal: {
      title: '法律声明',
      section1: {
        title: '1. 信息概述',
        body: 'Creasia 致力于在西班牙和中国之间组织文化活动、旅行、培训与咨询。访问和使用本网站即表示您接受本法律声明中的全部条款。'
      },
      section2: {
        title: '2. 个人数据保护',
        body1: '通过 Creasia 表单提交的个人数据将依据现行的数据保护法规（欧盟条例 2016/679 及西班牙有机法 3/2018）进行处理。',
        body2: '数据处理的目的在于管理与用户的关系、发送有关 Creasia 活动、资讯与服务的信息，并回复相关咨询。除非法律要求，数据不会提供给第三方。',
        body3Before: '用户可以通过 ',
        contactLink: '联系我们',
        body3After: ' 栏目行使访问、更正、删除、限制、反对及数据可携带等权利。',
        body4: '如需停止接收我们的信息，也可以通过同一页面提出申请。'
      },
      section3: {
        title: '3. 旅行与活动责任',
        body1: 'Creasia 作为旅行和文化活动的中介，与外部供应商合作。在旅程或活动期间发生的任何事故、延误、取消、行程变更、意外、遗失或损害，Creasia 概不负责。',
        body2: '参与者须自行满足旅行所需的法律和健康要求，并购买相应的保险。'
      },
      section4: {
        title: '4. 内容与知识产权',
        body1: '本网站上的所有内容（包括文字、图片、标识和设计）均归 Creasia 或相关权利人所有，并受知识产权法保护。',
        body2: '未经明确许可，禁止复制、分发或公开传播网站内容。'
      },
      section5: {
        title: '5. 外部链接',
        body1: '本网站可能包含指向外部页面的链接。Creasia 不对这些页面的内容、准确性或运行承担责任，也不对访问它们可能造成的损失负责。'
      },
      section6: {
        title: '6. 更新与修改',
        body1: 'Creasia 保留在无需事先通知的情况下随时修改、更新或删除网站信息及本法律政策的权利。'
      },
      section7: {
        title: '7. 适用法律与司法管辖',
        body1: '本法律条款受西班牙法律管辖。因访问或使用本网站产生的任何争议，双方同意提交马德里法院处理，除非法律另有规定。'
      }
    }
  }
};

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw);
}

for (const [locale, cfg] of Object.entries(updates)) {
  const file = path.join(root, 'src', 'assets', 'i18n', `${locale}.json`);
  const data = readJson(file);
  if (cfg.sociosCaption) {
    data.socios.caption = cfg.sociosCaption;
  }
  if (cfg.headerLegal) {
    data.header.legal = cfg.headerLegal;
  }
  if (cfg.menuLegal && data.menu) {
    data.menu.legal = cfg.menuLegal;
  }
  data.legal = cfg.legal;
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
